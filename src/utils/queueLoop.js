function handleQueueLoopTrackEnd(player, track, payload) {
    if (
        player?.loop !== "queue" ||
        player._clearQueueRequested ||
        !track
    ) {
        return { updated: false, restarted: false };
    }

    const reason = String(payload?.reason || "").toLowerCase();
    if (["replaced", "loadfailed", "cleanup"].includes(reason)) {
        return { updated: false, restarted: false };
    }

    const repeatedTrack = player.queue?.pop?.();
    if (!repeatedTrack) return { updated: false, restarted: false };

    if (!Array.isArray(player._queueLoopRepeatTracks)) {
        player._queueLoopRepeatTracks = [];
    }
    player._queueLoopRepeatTracks.push(repeatedTrack);

    if (player.queue.length > 0) {
        return { updated: true, restarted: false };
    }

    player.queue.push(...player._queueLoopRepeatTracks);
    player._queueLoopRepeatTracks = [];
    return { updated: true, restarted: true };
}

function getQueueLoopRepeatCount(player) {
    return player?.loop === "queue" &&
        Array.isArray(player._queueLoopRepeatTracks)
        ? player._queueLoopRepeatTracks.length
        : 0;
}

module.exports = { handleQueueLoopTrackEnd, getQueueLoopRepeatCount };
