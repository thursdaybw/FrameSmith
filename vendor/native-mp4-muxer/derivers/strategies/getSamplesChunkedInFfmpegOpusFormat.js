export function getSamplesChunkedInFfmpegOpusFormat({ samples }) {

    if (!Array.isArray(samples)) {
        throw new Error(
            "getSamplesChunkedInFfmpegOpusFormat: expected samples to be an array\n" +
            "actual type: " + typeof samples
        );
    }

    const chunks = [];

    let currentPacketIndex = null;
    let currentChunk = null;
    let sampleCursor = 0;

    for (let i = 0; i < samples.length; i++) {

        const sample = samples[i];

        if (!Number.isInteger(sample.packetIndex)) {
            throw new Error(
                "getSamplesChunkedInFfmpegOpusFormat: sample missing packetIndex\n" +
                "index=" + i + "\n" +
                "sample=" + JSON.stringify(sample)
            );
        }

        if (sample.packetIndex !== currentPacketIndex) {
            currentPacketIndex = sample.packetIndex;
            currentChunk = { samples: [] };
            chunks.push(currentChunk);
        }

        currentChunk.samples.push({
            sample,
            sampleIndex: sampleCursor++
        });
    }

    return chunks;
}
