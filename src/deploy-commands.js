require("dotenv").config();

const { REST, Routes } = require("discord.js");

const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN);
const TEST_GUILD_ID = require("../config").testBotCommandGuildId;

(async () => {
    try {
        const appId = process.env.CLIENT_ID;
        if (!appId) {
            console.error("[euphire] CLIENT_ID is not set in .env");
            process.exit(1);
        }

        const commands = [
            require("./commands/botprofile").data,
            require("./commands/announce").data,
            require("./commands/cleanprofile").data,
            require("./commands/resetstats").data,
            require("./commands/clearglobalstats").data,
            require("./commands/viewuserprofile").data,
            require("./commands/profileaudit").data,
            require("./commands/modelprofile").data,
            require("./commands/developerprofile").data,
            require("./commands/createadminrole").data,
            require("./commands/assignadminrole").data,
            require("./commands/waitingroom").data,
            require("./commands/cancel-resumes").data,
            require("./commands/testjockie").data,
            require("./commands/testbot").data,
            ...require("./commands/model").commands.map((command) => command.data),
        ];
        console.log("[euphire] Registering the developer commands...");
        await rest.put(Routes.applicationCommands(appId), {
            body: commands.map((command) => command.toJSON()),
        });

        const testBotCommand = require("./commands/testbot").data.toJSON();
        const guildCommands = await rest.get(
            Routes.applicationGuildCommands(appId, TEST_GUILD_ID)
        );
        const existingTestBot = guildCommands.find(
            (command) => command.name === testBotCommand.name
        );
        if (existingTestBot) {
            await rest.patch(
                Routes.applicationGuildCommand(
                    appId,
                    TEST_GUILD_ID,
                    existingTestBot.id
                ),
                { body: testBotCommand }
            );
        } else {
            await rest.post(
                Routes.applicationGuildCommands(appId, TEST_GUILD_ID),
                { body: testBotCommand }
            );
        }

        console.log(
            `[euphire] Registered /testbot immediately in test guild ${TEST_GUILD_ID}.`
        );
        console.log("[euphire] Registered /botprofile, /announce, /cleanprofile, /resetstats, /clearglobalstats, /viewuserprofile, /profileaudit, /modelprofile, /developerprofile, /createadminrole, /assignadminrole, /waitingroom, /cancel-resumes, /testjockie, /testbot, /modelstats, /modelauto, /modelchannel, and /setmodel.");
    } catch (error) {
        console.error("[euphire] Failed to register slash commands:", error);
    }
})();
