const {
    ChannelType,
    EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder,
} = require("discord.js");
const { getGuildDataAsync, saveGuildData } = require("../utils/mongoGuildData");
const { updateGuildStatusBoard } = require("../utils/waitingRoom");
const { isDeveloper } = require("../utils/developerAccess");

const STATUS_COLOR = 0x2b2d31;

module.exports = {
    primaryOnly: true,
    data: new SlashCommandBuilder()
        .setName("waitingroom")
        .setDescription("Manage Euphie's bot status board (developer only)")
        .addSubcommand((subcommand) =>
            subcommand
                .setName("set")
                .setDescription("Choose the text channel for the status board")
                .addChannelOption((option) =>
                    option
                        .setName("channel")
                        .setDescription("Text channel where bot status will be displayed")
                        .addChannelTypes(
                            ChannelType.GuildText,
                            ChannelType.GuildAnnouncement
                        )
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("enable")
                .setDescription("Post and update the bot status board")
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("disable")
                .setDescription("Remove the status board without disconnecting active bots")
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("status")
                .setDescription("Show the status board settings")
        ),

    async execute(interaction) {
        if (!isDeveloper(interaction.user?.id)) {
            return interaction.reply({
                content: "You are not authorized to use this command.",
                flags: MessageFlags.Ephemeral,
            });
        }
        if (!interaction.guild) {
            return interaction.reply({
                content: "This command can only be used in a server.",
                flags: MessageFlags.Ephemeral,
            });
        }

        const action = interaction.options.getSubcommand();
        const data = await getGuildDataAsync(interaction.guildId);
        const statusChannelId =
            data.waitingRoomStatusTargetChannelId ||
            data.waitingRoomStatusChannelId ||
            data.waitingRoomChannelId;

        if (action === "status") {
            const channel = statusChannelId
                ? interaction.guild.channels.cache.get(statusChannelId)
                : null;
            const embed = new EmbedBuilder()
                .setColor(STATUS_COLOR)
                .setAuthor({ name: "EUPHIE  /  CONFIGURATION" })
                .setTitle("Bot status board")
                .setDescription(
                    `**State**\n${data.waitingRoomEnabled ? "ENABLED" : "DISABLED"}\n\n` +
                        `**Channel**\n${channel ? `#${channel.name}` : "Not configured"}`
                )
                .setFooter({ text: "This board reports session status only; bots do not join a standby voice channel." });
            return interaction.reply({
                embeds: [embed],
                flags: MessageFlags.Ephemeral,
                allowedMentions: { parse: [] },
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (action === "set") {
            const channel = interaction.options.getChannel("channel", true);
            data.waitingRoomStatusTargetChannelId = channel.id;
            await saveGuildData(interaction.guildId, data);
            if (!data.waitingRoomEnabled) {
                return interaction.editReply(
                    `Status channel set to #${channel.name}. Run \`/waitingroom enable\` to post the board.`
                );
            }
        } else if (action === "enable") {
            if (!statusChannelId) {
                return interaction.editReply(
                    "Choose a text channel first with `/waitingroom set`."
                );
            }
            data.waitingRoomEnabled = true;
            await saveGuildData(interaction.guildId, data);
        } else if (action === "disable") {
            data.waitingRoomEnabled = false;
            await saveGuildData(interaction.guildId, data);
        } else {
            return interaction.editReply("Unknown status board action.");
        }

        try {
            await updateGuildStatusBoard(interaction.guildId);
        } catch (error) {
            console.error(
                `[euphire] Could not update the bot status board in guild ${interaction.guildId}:`,
                error
            );
            return interaction.editReply(
                `Settings were saved, but the status board could not be updated: ${error.message}`
            );
        }

        return interaction.editReply(
            action === "disable"
                ? "The status board is disabled and its message was removed. Active playback was not changed."
                : "The Euphie bot status board is ready."
        );
    },
};
