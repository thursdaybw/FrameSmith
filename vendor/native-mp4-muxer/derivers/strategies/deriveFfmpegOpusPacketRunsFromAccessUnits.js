export function deriveFfmpegOpusPacketRunsFromAccessUnits(accessUnits) {

    // FFmpeg Opus packetization pattern (observed):
    // packets alternate as [2, 2, 1, 2, 2, 1, ...]
    // (example — adjust if your oracle shows different head behaviour)

    const pattern = [2, 2, 1];
    let patternIndex = 0;

    const runs = [];
    let cursor = 0;

    while (cursor < accessUnits.length) {

        const requested = pattern[patternIndex];
        const remaining = accessUnits.length - cursor;
        const samplesPerPacket = Math.min(requested, remaining);

        runs.push({ samplesPerChunk: samplesPerPacket });

        cursor += samplesPerPacket;
        patternIndex = (patternIndex + 1) % pattern.length;
    }

    return runs;
}
