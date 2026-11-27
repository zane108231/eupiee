const {
    EmbedBuilder,
    PermissionFlagsBits,
} = require("discord.js");
const { getGuildDataAsync, saveGuildData } = require("./mongoGuildData");
const coordinator = require("./mongoCoordinator");

const statusUpdates = new Map();
const STATUS_COLOR = 0x8b6cff;

function plainText(value, limit = 100) {
    return String(value || "Unknown")
        .replace(/@/g, "@\u200b")
        .replace(/[\r\n]+/g, " ")
        .slice(0, limit);
}

function getSessionVoiceChannel(client, guildId, guild) {
    const actualChannelId =
        guild.voiceStates?.cache?.get(client.user.id)?.channelId ||
        guild.members.me?.voice?.channelId ||
        guild.members.cache.get(client.user.id)?.voice?.channelId ||
        null;
    if (actualChannelId) return actualChannelId;

    const sessions = coordinator.botSessions.get(client.botId) || [];
    for (const voiceChannelId of sessions) {
        if (
            guild.channels.cache.has(voiceChannelId) &&
            coordinator.getSessionOwner(voiceChannelId) === client.botId
        ) {
            return voiceChannelId;
        }
    }

    const player = client.riffy?.players?.get(guildId);
    return player?.voiceChannel || null;
}

function getBotStatus(client, guild, guildId) {
    if (
        !client.isReady() ||
        !client.user ||
        coordinator.botStatus.get(client.botId) === "disconnected"
    ) {
        return { status: "OFFLINE", dj: null, voiceChannel: null };
    }

    const botGuild = client.guilds.cache.get(guildId) || guild;
    const voiceChannelId =
        coordinator.getBotVoiceChannelInGuild(client.botId, guildId) ||
        getSessionVoiceChannel(client, guildId, botGuild);
    const player = client.riffy?.players?.get(guildId);
    const hasReservedSession =
        voiceChannelId &&
        coordinator.getSessionOwner(voiceChannelId) === client.botId;
    const isConnected = Boolean(
        botGuild.voiceStates?.cache?.get(client.user.id)?.channelId ||
            botGuild.members.me?.voice?.channelId ||
            botGuild.members.cache.get(client.user.id)?.voice?.channelId
    );
    const inUse = Boolean(
        voiceChannelId || hasReservedSession || isConnected
    );
    const djId = inUse
        ? (voiceChannelId && coordinator.getSessionDJ(voiceChannelId)) ||
          player?.requesterId ||
          null
        : null;
    const voiceChannel =
        inUse &&
        voiceChannelId &&
        (botGuild.channels.cache.get(voiceChannelId) ||
            guild.channels.cache.get(voiceChannelId));
    const djMember = djId
        ? voiceChannel?.members?.get(djId) || guild.members.cache.get(djId)
        : null;
    const djUser =
        djMember?.user ||
        (djId &&
            coordinator
                .getAllClients()
                .map((botClient) => botClient.users.cache.get(djId))
                .find(Boolean));
    const djName = djId
        ? plainText(
              djMember?.displayName ||
                  djUser?.globalName ||
                  djUser?.username ||
                  `User ${djId}`
          )
        : null;
    return {
        status: inUse ? "IN USE" : "AVAILABLE",
        dj: djName,
        voiceChannel: voiceChannel?.name
            ? plainText(voiceChannel.name)
            : voiceChannelId
              ? "Connected to voice"
              : null,
    };
}

function buildStatusEmbed(clients, guild, guildId) {
    const sortedClients = [...clients].sort((a, b) => {
        if (a.botId === "euphie_main") return -1;
        if (b.botId === "euphie_main") return 1;
        return String(a.botId).localeCompare(String(b.botId));
    });

    const instances = sortedClients.map((client) => {
        const member = guild.members.cache.get(client.user?.id);
        const botName = plainText(
            member?.displayName || client.user?.username || client.botId
        );
        return { client, botName, state: getBotStatus(client, guild, guildId) };
    });
    const inUse = instances.filter(({ state }) => state.status === "IN USE").length;
    const offline = instances.filter(({ state }) => state.status === "OFFLINE").length;
    const available = instances.length - inUse - offline;

    const embed = new EmbedBuilder()
        .setColor(STATUS_COLOR)
        .setAuthor({ name: "EUPHIE  /  INSTANCE MONITOR" })
        .setTitle("Bot status")
        .setDescription(
            `**${plainText(guild.name, 200)}**\n` +
                `**${inUse} IN USE**  ·  ${available} AVAILABLE  ·  ${offline} OFFLINE`
        )
        .setFooter({
            text: "LIVE STATUS  ·  Session owners are plain text; no mentions are sent.",
        })
        .setTimestamp();

    for (const { client, botName, state } of instances) {
        const statusLine =
            state.status === "IN USE"
                ? `IN USE  ·  DJ: ${state.dj || "Not recorded"}  ·  VC: ${state.voiceChannel || "Connected"}`
                : state.status === "OFFLINE"
                  ? "OFFLINE  ·  Instance disconnected"
                  : "AVAILABLE  ·  No active voice session";
        embed.addFields({
            name: `${botName}  /  ${plainText(client.botId, 50)}`,
            value: statusLine,
            inline: false,
        });
    }

    if (!sortedClients.length) {
        embed.addFields({
            name: "No instances found",
            value: "No Euphie bot instances are currently connected to this server.",
        });
    }

    return embed;
}

async function fetchStatusChannel(client, guild, channelId) {
    let channel = guild.channels.cache.get(channelId);
    if (!channel) channel = await guild.channels.fetch(channelId);
    if (!channel?.isTextBased?.() || !channel.messages) {
        throw new Error(
            `Status channel ${channelId} is not a text-based channel.`
        );
    }

    const member =
        guild.members.me || (await guild.members.fetch(client.user.id));
    const permissions = channel.permissionsFor(member);
    const missing = [
        ["View Channel", PermissionFlagsBits.ViewChannel],
        ["Send Messages", PermissionFlagsBits.SendMessages],
        ["Embed Links", PermissionFlagsBits.EmbedLinks],
    ].filter(([, permission]) => !permissions?.has(permission));
    if (missing.length) {
        throw new Error(
            `Euphie is missing ${missing.map(([name]) => name).join(" and ")} in the status channel.`
        );
    }

    return channel;
}

async function removeStatusMessage(client, data, guildId) {
    if (!data.waitingRoomStatusMessageId || !data.waitingRoomStatusChannelId) {
        return;
    }

    try {
        const channel = await client.channels.fetch(
            data.waitingRoomStatusChannelId
        );
        const message = await channel?.messages?.fetch(
            data.waitingRoomStatusMessageId
        );
        await message?.delete();
    } catch (error) {
        if (error.code !== 10008 && error.code !== 10003) {
            throw error;
        }
    }

    data.waitingRoomStatusMessageId = null;
    data.waitingRoomStatusChannelId = null;
    await saveGuildData(guildId, data);
}

async function updateWaitingRoomStatusNow(guildId) {
    const data = await getGuildDataAsync(guildId);
    const mainClient = coordinator.getClient("euphie_main");
    const guild = mainClient?.guilds.cache.get(guildId);
    if (!mainClient?.isReady() || !guild) return;

    if (!data.waitingRoomEnabled) {
        await removeStatusMessage(mainClient, data, guildId);
        return;
    }

    const channelId =
        data.waitingRoomStatusTargetChannelId ||
        data.waitingRoomStatusChannelId ||
        data.waitingRoomChannelId;
    if (!channelId) return;

    const channel = await fetchStatusChannel(mainClient, guild, channelId);
    const clients = coordinator
        .getAllClients()
        .filter((client) => client.guilds.cache.has(guildId));
    const payload = {
        embeds: [buildStatusEmbed(clients, guild, guildId)],
        allowedMentions: {
            parse: [],
            users: [],
            roles: [],
            repliedUser: false,
        },
    };

    if (
        data.waitingRoomStatusMessageId &&
        data.waitingRoomStatusChannelId === channel.id
    ) {
        try {
            const message = await channel.messages.fetch(
                data.waitingRoomStatusMessageId
            );
            await message.edit(payload);
            return;
        } catch (error) {
            if (error.code !== 10008) throw error;
            console.warn(
                `[euphire] Status board message was deleted in guild ${guildId}; creating a replacement.`
            );
        }
    } else {
        await removeStatusMessage(mainClient, data, guildId);
    }

    const message = await channel.send(payload);
    data.waitingRoomStatusMessageId = message.id;
    data.waitingRoomStatusChannelId = channel.id;
    await saveGuildData(guildId, data);
}

async function updateWaitingRoomStatus(guildId) {
    if (!guildId) return;

    const previous = statusUpdates.get(guildId) || Promise.resolve();
    const current = previous
        .catch((error) => {
            console.error(
                `[euphire] Previous status board update failed for guild ${guildId}:`,
                error
            );
        })
        .then(() => updateWaitingRoomStatusNow(guildId));
    statusUpdates.set(guildId, current);

    try {
        await current;
    } finally {
        if (statusUpdates.get(guildId) === current) {
            statusUpdates.delete(guildId);
        }
    }
}

module.exports = { updateWaitingRoomStatus };
