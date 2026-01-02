/**
 * ChunkingStrategies
 * ==================
 *
 * Chunking strategies define how semantic samples are grouped
 * into chunks during structural derivation.
 *
 * This choice determines the *topology* of the resulting MP4,
 * not its semantic meaning and not its byte-level representation.
 *
 * These strategies are:
 * - selected before derivation begins
 * - consumed by deriveChunkModel
 * - mutually exclusive
 *
 * A chunking strategy answers:
 *
 *   “Given these samples, how should chunks be formed?”
 *
 * It does NOT answer:
 * - how chunks are written to bytes
 * - where chunks are placed in the file
 * - how compatibility quirks are handled
 *
 * Those concerns belong to later layers.
 */
export const ChunkingStrategies = {

    /**
     * ONE_SAMPLE_PER_CHUNK
     * --------------------
     *
     * Each sample is placed into its own chunk.
     *
     * Effects:
     * - maximum number of chunks
     * - simple, one-to-one chunk/sample mapping
     * - larger STCO/STSC tables
     *
     * This strategy is useful for:
     * - testing
     * - validation
     * - stress-testing chunk tables
     *
     * It makes no assumptions about playback behavior.
     */
    ONE_SAMPLE_PER_CHUNK: "one-sample-per-chunk",

    /**
     * ALL_SAMPLES_ONE_CHUNK
     * --------------------
     *
     * All samples are placed into a single chunk.
     *
     * Effects:
     * - minimal number of chunks
     * - minimal STCO/STSC tables
     * - simple physical layout
     *
     * This strategy is useful for:
     * - minimal files
     * - deterministic layout
     * - golden reference comparisons
     *
     * It does not change sample timing or ordering.
     */
    ALL_SAMPLES_ONE_CHUNK: "all-samples-one-chunk"
};
