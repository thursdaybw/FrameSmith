/**
 * Chunking policies for NativeMuxer.
 *
 * A chunking policy answers:
 *   “How are samples grouped into chunks?”
 *
 * This is a semantic decision, not a byte-level one.
 */
export const ChunkPolicies = {
    ONE_SAMPLE_PER_CHUNK: "one-sample-per-chunk",
    ALL_SAMPLES_ONE_CHUNK: "all-samples-one-chunk"
};
