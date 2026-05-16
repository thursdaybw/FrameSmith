export function deriveCttsEntries({ samples }) {

    if (!Array.isArray(samples)) {
        throw new Error(
            "deriveCttsEntries: samples must be an array"
        );
    }

    if (samples.length === 0) {
        return [];
    }

    // CTTS offset = PTS - DTS
    // In your extractor model, timestamp is DTS,
    // and CTTS offset is inferred from presentation order.
    // For now, assume samples carry `compositionOffset`
    // (0 if none).

    const entries = [];

    let currentOffset = null;
    let runCount = 0;

    for (let i = 0; i < samples.length; i++) {
        const s = samples[i];

        const offset =
            Number.isInteger(s.compositionOffset)
                ? s.compositionOffset
                : 0;

        if (currentOffset === null) {
            currentOffset = offset;
            runCount = 1;
            continue;
        }

        if (offset === currentOffset) {
            runCount++;
        } else {
            entries.push({
                sampleCount: runCount,
                sampleOffset: currentOffset
            });
            currentOffset = offset;
            runCount = 1;
        }
    }

    entries.push({
        sampleCount: runCount,
        sampleOffset: currentOffset
    });

    return entries;
}
