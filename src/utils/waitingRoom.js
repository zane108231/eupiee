const { getGuildDataAsync } = require("./mongoGuildData");
const { updateWaitingRoomStatus } = require("./waitingRoomStatus");

async function updateGuildStatusBoard(guildId) {
    await updateWaitingRoomStatus(guildId);
}

async function refreshClientStatusBoards(client) {
    for (const guild of client.guilds.cache.values()) {
        try {
            const data = await getGuildDataAsync(guild.id);
            if (
                data.waitingRoomEnabled &&
                (data.waitingRoomStatusTargetChannelId ||
                    data.waitingRoomStatusChannelId ||
                    data.waitingRoomChannelId)
            ) {
                await updateWaitingRoomStatus(guild.id);
            }
        } catch (error) {
            console.error(
                `[euphire] Could not update the status board for ${client.botId} in guild ${guild.id}:`,
                error
            );
        }
    }
}

module.exports = {
    updateGuildStatusBoard,
    refreshClientStatusBoards,
};
