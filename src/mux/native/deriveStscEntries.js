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
        throw new Error(
            "deriveStscEntries: chunks must be a non-empty array"
        );
    }

    const firstChunk = 1;

    const samplesPerChunk = chunks[0].samples.length;

    // -----------------------------------------------------------------
    // Derive sample_description_index from semantic samples
    // -----------------------------------------------------------------
    const firstSample = chunks[0].samples[0];

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
            throw new Error(
                "deriveStscEntries: variable samples-per-chunk not supported"
            );
        }

        for (const sample of chunk.samples) {
            if (sample.sampleDescriptionIndex !== sampleDescriptionIndex) {
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
