const {
    ActionRowBuilder,
    EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
} = require("discord.js");
const coordinator = require("../utils/mongoCoordinator");
const { isDeveloper } = require("../utils/developerAccess");

const AUTOMATIC_OPTION = "automatic";

function getGuildBots(guildId) {
    return coordinator
        .getAllClients()
        .filter(
            (client) =>
                client.isReady() &&
                client.guilds.cache.has(guildId)
        )
        .map((client) => ({
            id: client.botId,
            name:
                coordinator.botConfigs.find((bot) => bot.id === client.botId)
                    ?.name || client.user?.username || client.botId,
        }));
}

function buildPrompt(guildId, userId) {
    const bots = getGuildBots(guildId);
    const selectedBotId = coordinator.getDeveloperTestBot(userId, guildId);
    const selectedBot = bots.find((bot) => bot.id === selectedBotId);
    const menu = new StringSelectMenuBuilder()
        .setCustomId(`testbot:select:${userId}`)
        .setPlaceholder("Choose an Euphie bot for testing")
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(
            {
                label: "Automatic routing",
                value: AUTOMATIC_OPTION,
                description: "Return to the normal bot-selection behavior",
                default: !selectedBot,
            },
            ...bots.map((bot) => ({
                label: bot.name.slice(0, 100),
                value: bot.id,
                description: `Route your prefix commands to ${bot.id}`,
                default: bot.id === selectedBotId,
            }))
        );

    const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle("Developer bot testing")
        .setDescription(
            "Choose which Euphie handles your **prefix commands** in this server.\n\n" +
                "Existing voice sessions keep their current bot. Slash commands keep normal routing. " +
                "This test selection is temporary and resets when the bot restarts."
        );

    return {
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(menu)],
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
    };
}

module.exports = {
    primaryOnly: true,
    slashOnly: true,
    data: new SlashCommandBuilder()
        .setName("testbot")
        .setDescription("Choose an Euphie bot for developer command testing"),

    async execute(interaction) {
        if (!isDeveloper(interaction.user?.id)) {
            return interaction.reply({
                content: "Only a configured Euphie developer can use this command.",
                flags: MessageFlags.Ephemeral,
            });
        }
        if (!interaction.guildId) {
            return interaction.reply({
                content: "Use this command in a server where the Euphie bots are present.",
                flags: MessageFlags.Ephemeral,
            });
        }

        const bots = getGuildBots(interaction.guildId);
        if (bots.length === 0) {
            return interaction.reply({
                content: "No ready Euphie bots are available in this server.",
                flags: MessageFlags.Ephemeral,
            });
        }

        return interaction.reply(
            buildPrompt(interaction.guildId, interaction.user.id)
        );
    },

    async handleSelection(interaction) {
        const [, , ownerId] = interaction.customId.split(":");
        if (
            !isDeveloper(interaction.user?.id) ||
            interaction.user.id !== ownerId
        ) {
            return interaction.reply({
                content: "This developer-only selection is not yours to use.",
                flags: MessageFlags.Ephemeral,
            });
        }
        if (!interaction.guildId) {
            return interaction.update({
                content: "This selection is only available in a server.",
                embeds: [],
                components: [],
            });
        }

        const selectedBotId = interaction.values[0];
        if (selectedBotId === AUTOMATIC_OPTION) {
            coordinator.clearDeveloperTestBot(
                interaction.user.id,
                interaction.guildId
            );
            return interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x2b2d31)
                        .setTitle("Automatic routing restored")
                        .setDescription(
                            "Your prefix commands will use Euphie's normal bot selection in this server."
                        ),
                ],
                components: [],
                allowedMentions: { parse: [] },
            });
        }

        const selectedBot = getGuildBots(interaction.guildId).find(
            (bot) => bot.id === selectedBotId
        );
        if (!selectedBot) {
            return interaction.update({
                content: "That Euphie bot is no longer ready in this server. Run `/testbot` again to choose another.",
                embeds: [],
                components: [],
            });
        }

        if (
            !coordinator.setDeveloperTestBot(
                interaction.user.id,
                interaction.guildId,
                selectedBotId
            )
        ) {
            return interaction.update({
                content: "Could not save that test-bot selection. Run `/testbot` and try again.",
                embeds: [],
                components: [],
            });
        }

        return interaction.update({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x2b2d31)
                    .setTitle("Test bot selected")
                    .setDescription(
                        `Your prefix commands in this server will be routed to **${selectedBot.name}**.`
                    )
                    .setFooter({
                        text: "Existing sessions stay with their current bot. Run /testbot to switch or restore automatic routing.",
                    }),
            ],
            components: [],
            allowedMentions: { parse: [] },
        });
    },
};
