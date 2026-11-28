require("dotenv").config();

module.exports = {
    node: {
        host: "193.226.78.187",
        password: "zealooser",
        port: 2054,
        secure: false,
        name: "Main",
    },
    backupNode: {
        host: "lavalink.jirayu.net",                                
        // Leave password unset to use Riffy's built-in Lavalink default.
        port: 13592,
        secure: false,
        name: "Backup",
    },

    prefix: "e!",
    testBotCommandGuildId: "1501116811826036858",

    defaultSearchPlatform: "spsearch",
    restVersion: "v4",

    accentColor: 0x2b2d31,
    statusWebhookUrl: process.env.STATUS_WEBHOOK_URL,
    geniusApiKey: process.env.GENIUS_API_KEY || process.env.GENIUS_ACCESS_TOKEN || null,

    musicard: {
        theme: "Bloom",
        progressBarColor: "#FACC15",
        backgroundColor: "#2b2d31",
    },
};
