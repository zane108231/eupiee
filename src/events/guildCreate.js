const { getGuildDataAsync } = require("../utils/mongoGuildData");
const { updateWaitingRoomStatus } = require("../utils/waitingRoomStatus");

module.exports = {
    name: "guildCreate",
    async execute(client, guild) {
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
                `[euphire] Could not update the status board after ${client.botId} joined guild ${guild.id}:`,
                error
            );
        }
    },
};
