/**
 * Decide how samples are grouped into chunks.
 *
 * This module owns chunking *policy*.
 * It does not write boxes.
 * It does not compute offsets.
 * It does not touch bytes.
 *
 * It answers one question:
 *   "How many samples go into each chunk?"
 */
export function planChunkLayout({ policy, samples }) {

    if (!Array.isArray(samples)) {
        throw new Error("planChunkLayout: samples must be an array");
    }

    if (typeof policy !== "string") {
        throw new Error("planChunkLayout: policy must be a string");
    }

    switch (policy) {

        case "framesmith-simple":
            return {
                firstChunk: 1,
                samplesPerChunk: 1,
                sampleDescriptionIndex: 1
            };

        case "ffmpeg-compatible":
            return {
                firstChunk: 1,
                samplesPerChunk: 25,
                sampleDescriptionIndex: 1
            };

        default:
            throw new Error(
                `planChunkLayout: unknown policy '${policy}'`
            );
    }
}
