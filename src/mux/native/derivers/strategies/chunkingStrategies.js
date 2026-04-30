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
    ALL_SAMPLES_ONE_CHUNK: "all-samples-one-chunk",

    /**
     * PACKETIZED
     * ----------
     *
     * Samples are grouped according to explicit packet identity.
     *
     * Requires:
     * - each sample to declare a packetIndex
     *
     * This strategy is representational, not semantic.
     *
     * ** Future Contract **
     *
     * Introduce ONE explicit semantic authorization
     * 
     * At the boundary (client / adapter):
     *
     * ```
     * semanticHints.packetization = {
     *     mode: "explicit" | "derive-from-source" | "synthesize"
     * }
     * ```
     * Defaults to "explicit".
     * 
     * Meaning of each mode
     *
     * explicit (default, safest)
     * 
     *   Client must provide:
     * 
     *   accessUnit.packetIndex or
     *     semanticHints.packetRuns
     *     Compiler throws otherwise
     *   
     *   This is what I have now.
     *   This is correct for oracle input.
     * 
     * derive-from-source
     * 
     *   Allowed ONLY when source provides a topology signal
     *   For oracle MP4:
     *     derive from STSC
     *   For WebCodecs:
     *     ❌ not allowed (no signal)
     *
     *   This is still non-guessing.
     * 
     * synthesize (UX escape hatch)
     * 
     *   Compiler is explicitly authorized to invent packetization
     * 
     *   Rule used:
     *   ```
     *     one accessUnit == one packet
     *   ```
     *   This is not default
     *   This is opt-in
     *   This is how “just give me MP4” works
     *   This keeps the lie honest.
     *
     * “Users aren’t MP4 experts”
     *   They don’t have to be.
     * 
     *   This high-level API can do:
     *   ```
     *   createMp4FromWebCodecs({
     *       packetization: "auto"
     *   })
     *   ``` 
     *   Which maps internally to:
     *   ``` 
     *   semanticHints.packetization = { mode: "synthesize" }
     *   ``` 
     *   The low-level compiler stays pure.
     */
    PACKETIZED: "packetized",

    /**
     * This is for support byte for byte oracle comparison with 
     * reference_av_opus.mp4 in tests
     */
    FFMPEG_OPUS_PACKET_GROUPED: "ffmpeg-opus-packet-grouped",

    // declared but not yet implemented
    FIXED_SAMPLES_PER_CHUNK: "fixed-samples-per-chunk",
    GOP_ALIGNED: "gop-aligned",
    FIXED_DURATION_CHUNKS: "fixed-duration-chunks",
};
