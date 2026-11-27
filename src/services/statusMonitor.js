const { EmbedBuilder, WebhookClient } = require("discord.js");
const config = require("../../config");

let webhookClient = null;

function clip(value, limit = 1024) {
    const text = String(value ?? "Not available");
    return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

function getWebhookClient() {
    if (!config.statusWebhookUrl) return null;
    if (!webhookClient) {
        webhookClient = new WebhookClient({ url: config.statusWebhookUrl });
    }
    return webhookClient;
}

async function sendPlaybackFailureLog({
    client,
    context,
    query,
    reason,
    searchSource,
    attemptedSearches = [],
    loadType,
    track,
    error,
}) {
    let webhook;
    try {
        webhook = getWebhookClient();
    } catch (error) {
        console.error("[euphire] Could not initialize playback failure webhook:", error.message);
        return;
    }
    if (!webhook) return;

    const user = context?.user || context?.author;
    const guild = context?.guild;
    const channel = context?.channel;
    const voiceChannel =
        context?.member?.voice?.channel || context?.voiceChannel;
    const userLabel = user
        ? `${user.tag || user.username || "Unknown user"} (${user.id})`
        : "Not available";
    const trackLabel = track?.info
        ? `${track.info.title || "Unknown title"}${track.info.author ? ` — ${track.info.author}` : ""}`
        : null;
    const errorDetails = error
        ? [error.name, error.code, error.message || String(error)]
              .filter(Boolean)
              .join(": ")
        : null;

    const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle("Playback Search Failure")
        .setDescription(clip(reason, 4000))
        .setTimestamp()
        .addFields(
            { name: "User", value: clip(userLabel), inline: true },
            {
                name: "Guild",
                value: clip(guild ? `${guild.name} (${guild.id})` : "Not available"),
                inline: true,
            },
            {
                name: "Text channel",
                value: clip(channel ? `#${channel.name || "unknown"} (${channel.id})` : "Not available"),
                inline: true,
            },
            {
                name: "Voice channel",
                value: clip(voiceChannel ? `${voiceChannel.name} (${voiceChannel.id})` : "Not available"),
                inline: true,
            },
            { name: "Requested search", value: clip(query), inline: false },
            {
                name: "Search source",
                value: clip(searchSource || "Not available"),
                inline: true,
            },
            {
                name: "Load type",
                value: clip(loadType || "Not available"),
                inline: true,
            },
            ...(trackLabel
                ? [{ name: "Resolved track", value: clip(trackLabel), inline: false }]
                : []),
            {
                name: "Exact search attempts",
                value: clip(
                    attemptedSearches.length
                        ? attemptedSearches.map((item) => `• ${item}`).join("\n")
                        : "No search request was recorded",
                    1024
                ),
                inline: false,
            },
            ...(errorDetails
                ? [{ name: "Error details", value: clip(errorDetails), inline: false }]
                : []),
            ...(client?.botId
                ? [{ name: "Bot instance", value: clip(client.botId), inline: true }]
                : [])
        );

    try {
        await webhook.send({
            embeds: [embed],
            allowedMentions: { parse: [] },
        });
    } catch (sendError) {
        console.error(
            "[euphire] Failed to send playback failure to status webhook:",
            sendError.message
        );
    }
}

function startStatusMonitor() {
    if (!config.statusWebhookUrl) {
        console.warn("[euphire] STATUS_WEBHOOK_URL not set — playback failure logging disabled.");
        return;
    }

    try {
        getWebhookClient();
        console.log("[euphire] Playback failure webhook logging enabled.");
    } catch (error) {
        console.error(
            "[euphire] Could not initialize playback failure webhook:",
            error.message
        );
    }
}

module.exports = {
    startStatusMonitor,
    sendPlaybackFailureLog,
};
