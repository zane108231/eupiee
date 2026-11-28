const path = require("path");
const { AttachmentBuilder, EmbedBuilder } = require("discord.js");

function createStopConfirmationPayload() {
    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setDescription(
            "Thank you for using our service!\n\n" +
                "Come join our [support server](https://discord.gg/mCCyM8Msxm) to get information about updates, issues and for discussions about bot features!\n\n" +
                "Your suggestions and opinions are always considered!"
        )
        .setImage("attachment://euphie-banner.png");

    const banner = new AttachmentBuilder(
        path.join(__dirname, "..", "assets", "euphie-banner.png"),
        { name: "euphie-banner.png" }
    );

    return { embeds: [embed], files: [banner] };
}

module.exports = { createStopConfirmationPayload };
