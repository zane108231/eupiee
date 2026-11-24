const {
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
} = require("discord.js");
const { isDeveloper } = require("../utils/developerAccess");
const coordinator = require("../utils/mongoCoordinator");

const ROLE_NAME = "Euphie Administrator";
const ROLE_BOT_ID = "euphie_2";

module.exports = {
    primaryOnly: true,
    data: new SlashCommandBuilder()
        .setName("giverole")
        .setDescription("Create and give Euphie's administrator role")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand((subcommand) =>
            subcommand
                .setName("admin")
                .setDescription("Create/reuse the admin role and give it to a member")
                .addUserOption((option) =>
                    option
                        .setName("member")
                        .setDescription("Member who will receive administrator permissions")
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({
                content: "❌ This command can only be used in a server.",
                flags: MessageFlags.Ephemeral,
            });
        }

        if (!isDeveloper(interaction.user?.id)) {
            return interaction.reply({
                content: "❌ Only a configured Euphie developer can use this command.",
                flags: MessageFlags.Ephemeral,
            });
        }

        const isServerAdmin =
            interaction.guild.ownerId === interaction.user.id ||
            interaction.memberPermissions?.has(
                PermissionFlagsBits.Administrator
            );
        if (!isServerAdmin) {
            return interaction.reply({
                content:
                    "❌ You must own this server or have Administrator permission to give out an admin role.",
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        let role;
        let createdRole = false;
        let assignedRole = false;
        try {
            const user = interaction.options.getUser("member", true);
            if (user.bot) {
                return interaction.editReply({
                    content: "❌ Choose a human server member, not a bot.",
                });
            }

            const roleBot = coordinator.getClient(ROLE_BOT_ID);
            if (!roleBot?.isReady()) {
                return interaction.editReply({
                    content:
                        "❌ Euphie (2) is not connected. Start it locally and make sure it has joined this server.",
                });
            }

            let guild = roleBot.guilds.cache.get(interaction.guildId);
            if (!guild) {
                guild = await roleBot.guilds.fetch(interaction.guildId);
            }
            await guild.roles.fetch();

            const botMember =
                guild.members.me ||
                (await guild.members.fetch(roleBot.user.id));
            if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
                return interaction.editReply({
                    content:
                        "❌ Euphie (2) needs the Manage Roles permission to create and assign the role.",
                });
            }

            const highestRole = botMember.roles.highest;
            if (highestRole.position <= 1) {
                return interaction.editReply({
                    content:
                        "❌ Move Euphie (2)'s highest role above @everyone so there is room to place the new role below it.",
                });
            }

            role = guild.roles.cache.find(
                (candidate) =>
                    candidate.name === ROLE_NAME && !candidate.managed
            );
            if (role && !role.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.editReply({
                    content:
                        `❌ A regular role named "${ROLE_NAME}" already exists without Administrator permission. ` +
                        "Rename it or add the permission, then try again.",
                });
            }

            const reason = `Administrator role requested by Euphie developer ${interaction.user.id}`;
            if (!role) {
                role = await guild.roles.create({
                    name: ROLE_NAME,
                    permissions: [PermissionFlagsBits.Administrator],
                    reason,
                });
                createdRole = true;
            }

            const positionBelowBot = highestRole.position - 1;
            if (role.position !== positionBelowBot) {
                role = await role.setPosition(positionBelowBot, { reason });
            }

            const member = await guild.members.fetch(user.id);
            if (member.roles.cache.has(role.id)) {
                return interaction.editReply({
                    content: `ℹ️ ${member} already has ${role}.`,
                });
            }

            await member.roles.add(role, reason);
            assignedRole = true;

            return interaction.editReply({
                content:
                    `✅ ${createdRole ? `Created ${role} below Euphie (2)'s highest role and assigned it to` : `Assigned ${role} to`} ${member}. ` +
                    "This role grants full server permissions.",
            });
        } catch (error) {
            console.error(
                `[euphire] Failed to create or assign the administrator role in guild ${interaction.guildId}:`,
                error
            );
            const detail = assignedRole
                ? "The role was assigned, but Euphie could not send the confirmation."
                : createdRole
                  ? `The role ${role} was created, but Euphie (2) could not finish placing or assigning it. Check its role hierarchy and assign the role manually if needed.`
                  : "Check that Euphie (2) is in this server, has Manage Roles, and has a higher role than the new admin role.";
            return interaction.editReply({
                content: `❌ Could not complete the admin-role operation. ${detail}`,
            });
        }
    },
};
