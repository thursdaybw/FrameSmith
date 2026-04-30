/**
 * STSC — Sample To Chunk Box
 * -------------------------
 * Defines how samples are grouped into chunks within a track.
 *
 * This box answers the question:
 *
 *   “Given a chunk number, how many samples does it contain,
 *    and which sample description applies to them?”
 *
 * It does NOT describe:
 *   - sample sizes        (stsz)
 *   - sample timing       (stts)
 *   - chunk byte offsets  (stco / co64)
 *
 * Those concerns are handled by other boxes.
 *
 * ---
 *
 * Samples, chunks, and why this box exists:
 * -----------------------------------------
 * In MP4:
 *
 *   • A *sample* is a single unit of encoded media
 *     (for video: one encoded frame).
 *
 *   • A *chunk* is a contiguous run of samples stored together
 *     in the file’s media data (mdat).
 *
 * Chunks exist for efficiency:
 *   - fewer file seeks
 *   - better streaming and buffering behavior
 *
 * The STSC table maps:
 *   chunk number → samples per chunk → sample description
 *
 * ---
 *
 * How STSC works (conceptually):
 * ------------------------------
 * STSC uses a run-length table.
 *
 * Each entry says:
 *
 *   “Starting at chunk N,
 *    each chunk contains S samples,
 *    using sample description D,
 *    until the next rule appears.”
 *
 * This allows complex layouts without listing every chunk explicitly.
 *
 * ---
 *
 * Framesmith’s MVP design choice:
 * -------------------------------
 * Framesmith currently supports emitting the simplest valid STSC table by default.
 * More complex layouts are provided explicitly via chunkLayout.
 *
 *   entry_count = 1
 *   first_chunk = 1
 *   samples_per_chunk = 1
 *   sample_description_index = 1
 *
 * Meaning:
 *   - Every chunk contains exactly one sample
 *   - All samples use the first (and only) sample description
 *
 * This layout:
 *   - Matches ffmpeg output for simple streams
 *   - Matches mp4box.js default behavior
 *   - Matches browser-generated MP4s
 *   - Is universally valid and easy to reason about
 *
 * ---
 *
 * Why this is sufficient (for now):
 * --------------------------------
 * Using one sample per chunk:
 *   - Keeps chunk math trivial
 *   - Avoids complex interleaving logic
 *   - Makes offsets (stco) and sizes (stsz) easier to validate
 *
 * More advanced layouts (multiple samples per chunk, interleaving,
 * fragmentation) belong in *assembly logic*, not in this box builder.
 *
 * This builder intentionally does not infer or optimize chunking.
 *
 * ---
 *
 * Defensive handling of inputs:
 * -----------------------------
 * The input list of samples is copied immediately.
 *
 * This ensures:
 *   - Later changes to the caller’s data cannot affect this box
 *   - The MP4 structure remains immutable once built
 *   - Tests can rely on deterministic behavior
 *
 * Even though the current implementation does not yet inspect
 * sample data, this defensive pattern is preserved for future
 * extensions.
 *
 * ---
 *
 * External references:
 * - ISO/IEC 14496-12 — Sample To Chunk Box (stsc)
 * - MP4 registry: https://mp4ra.org/registered-types/boxes
 * - mp4box.js reference implementation
 */
function emitStscBox(params) {

    // ---------------------------------------------------------
    // Contract validation
    // ---------------------------------------------------------
    if (!params || !Array.isArray(params.entries) || params.entries.length === 0) {
        throw new Error(
            "emitStscBox: entries must be a non-empty array"
        );
    }

    // Validate each entry explicitly
    for (let i = 0; i < params.entries.length; i++) {
        const entry = params.entries[i];

        if (!Number.isInteger(entry.firstChunk) || entry.firstChunk < 1) {
            throw new Error(
                "emitStscBox: firstChunk must be a positive integer (1-based)"
            );
        }

        if (!Number.isInteger(entry.samplesPerChunk) || entry.samplesPerChunk < 1) {
            throw new Error(
                "emitStscBox: samplesPerChunk must be a positive integer"
            );
        }

        if (
            !Number.isInteger(entry.sampleDescriptionIndex) ||
            entry.sampleDescriptionIndex < 1
        ) {
            throw new Error(
                "emitStscBox: sampleDescriptionIndex must be a positive integer (1-based)"
            );
        }
    }

    // ---------------------------------------------------------
    // Defensive snapshot
    // ---------------------------------------------------------
    // Copy values so later mutation of input cannot affect output
    const entries = [];

    for (let i = 0; i < params.entries.length; i++) {
        const src = params.entries[i];

        entries.push({
            firstChunk: src.firstChunk,
            samplesPerChunk: src.samplesPerChunk,
            sampleDescriptionIndex: src.sampleDescriptionIndex
        });
    }

    // ---------------------------------------------------------
    // STSC serialization
    // ---------------------------------------------------------
    // STSC is a FullBox that defines a table mapping:
    //
    //   chunk index → samples per chunk → sample description index
    //
    // Each table entry applies starting from firstChunk
    // until the next entry (or end of stream).
    //
    const body = [];

    /**
     * entry_count
     * -----------
     * Number of mapping rules that follow.
     *
     * Each rule defines how chunks are populated with samples.
     */
    body.push({ int: entries.length });

    /**
     * entries
     * -------
     * Each entry consists of:
     *
     *   first_chunk
     *   samples_per_chunk
     *   sample_description_index
     *
     * Entries are evaluated in order.
     */
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];

        body.push({ int: entry.firstChunk });
        body.push({ int: entry.samplesPerChunk });
        body.push({ int: entry.sampleDescriptionIndex });
    }

    return {
        type: "stsc",
        version: 0,
        flags: 0,
        body
    };
}

export function registerStscEmitter(registry) {
    registry.registerEmitter(
        "moov/trak/mdia/minf/stbl/stsc",
        emitStscBox
    );
}
