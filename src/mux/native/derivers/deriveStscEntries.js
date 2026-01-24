/**
 * Derive STSC (Sample To Chunk) table entries from semantic chunks.
 *
 * This function is:
 * - Pure
 * - Deterministic
 * - Independent of timing, bytes, offsets, or layout
 *
 * It answers one question only:
 *   “Given these chunks, how are samples mapped to chunks?”
 *
 * Current scope:
 * - Canonical single-pattern STSC only
 * - One entry
 * - 1-based indexing (MP4 spec)
 */
export function deriveStscEntries({ samples, chunks }) {

    if (!Array.isArray(chunks) || chunks.length === 0) {
        throw new Error("deriveStscEntries: chunks must be a non-empty array");
    }

    const entries = [];

    let previousSamplesPerChunk = null;

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {

        const chunk = chunks[chunkIndex];
        const samplesPerChunk = chunk.samples.length;

        if (previousSamplesPerChunk !== samplesPerChunk) {

            entries.push({
                firstChunk: chunkIndex + 1, // MP4 is 1-based
                samplesPerChunk,
                sampleDescriptionIndex: 1
            });

            previousSamplesPerChunk = samplesPerChunk;
        }
    }

    return entries;
}

export function deriveStscEntriesoff({ samples, chunks }) {

    if (!Array.isArray(chunks) || chunks.length === 0) {
        throw new Error(
            "deriveStscEntries: chunks must be a non-empty array"
        );
    }

    const firstChunk = 1;
    const samplesPerChunk = chunks[0].samples.length;


    // -----------------------------------------------------------------
    // Read sample_description_index from semantic samples (authoritative)
    // -----------------------------------------------------------------
    const firstSample = samples[0];

    if (
        !firstSample ||
        !Number.isInteger(firstSample.sampleDescriptionIndex) ||
        firstSample.sampleDescriptionIndex < 1
    ) {
        throw new Error(
            "deriveStscEntries: samples must carry a valid sampleDescriptionIndex"
        );
    }

    const sampleDescriptionIndex =
        firstSample.sampleDescriptionIndex;

    // -----------------------------------------------------------------
    // Invariant: single-pattern STSC
    // -----------------------------------------------------------------
    for (const chunk of chunks) {

        if (chunk.samples.length !== samplesPerChunk) {
            /*
            throw new Error(
                "deriveStscEntries: variable samples-per-chunk not supported"
            );
            */
            console.warn("deriveStscEntries: variable samples-per-chunk is experimental");
        }

        for (const wrapped of chunk.samples) {
            const sdi = wrapped.sample.sampleDescriptionIndex;

            if (sdi !== sampleDescriptionIndex) {
                throw new Error(
                    "deriveStscEntries: mixed sampleDescriptionIndex values not supported"
                );
            }
        }
    }

    return [
        {
            firstChunk,
            samplesPerChunk,
            sampleDescriptionIndex
        }
    ];
}
