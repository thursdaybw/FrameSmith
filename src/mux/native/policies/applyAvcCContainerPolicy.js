/*
 * applyAvcCContainerPolicy
 * =======================
 *
 * Ensures that an AVCDecoderConfigurationRecord (`avcC` payload) is
 * **container-complete** at the point of MP4 box emission.
 *
 * This function sits at a strict architectural boundary:
 *
 *   semantic adaptation
 *        ↓
 *   container policy   ← (this function)
 *        ↓
 *   MP4 box emission
 *
 * It exists to make **explicit, testable container-level decisions**
 * that are:
 *
 *   - not semantic facts
 *   - not derivable from encoder output alone
 *   - not appropriate for source adapters
 *   - not appropriate for box emitters
 *
 * -------------------------------------------------------------------------
 * avcC Completeness Model
 * -------------------------------------------------------------------------
 *
 * The compiler distinguishes between TWO forms of avcC payloads:
 *
 *   1. "semantic"
 *      - Contains only encoder-emitted facts
 *      - Typical of WebCodecs output
 *      - Lacks container-level completion bytes
 *
 *   2. "container-complete"
 *      - Contains all bytes required by the MP4 container
 *      - Typical of demuxed / transmuxed MP4 files
 *      - Represents historical container decisions
 *
 * The source adapter is responsible for declaring which form it provides.
 * This policy never guesses or infers completeness.
 *
 * -------------------------------------------------------------------------
 * Policy Behavior
 * -------------------------------------------------------------------------
 *
 * If `avcCCompleteness === "container-complete"`:
 *
 *   - The avcC payload is preserved byte-for-byte
 *   - No mutation is permitted
 *   - Historical container decisions are maintained exactly
 *
 * If `avcCCompleteness === "semantic"`:
 *
 *   - The avcC payload is deterministically completed for MP4 emission
 *   - A 4-byte High Profile extension is appended
 *   - The extension matches ffmpeg-compatible defaults:
 *
 *       chroma_format_idc        = 1  (4:2:0)
 *       bit_depth_luma_minus8   = 0  (8-bit)
 *       bit_depth_chroma_minus8 = 0  (8-bit)
 *       reserved                = 0
 *
 * These bytes are:
 *   - NOT part of SPS or PPS
 *   - NOT semantic codec facts
 *   - NOT guaranteed to be provided by encoders
 *   - REQUIRED for broad MP4 decoder compatibility
 *
 * -------------------------------------------------------------------------
 * Architectural Guarantees
 * -------------------------------------------------------------------------
 *
 * - No SPS parsing
 * - No PPS inspection
 * - No profile or level inference
 * - No heuristic detection of existing extensions
 * - No MP4 box emission
 *
 * Inputs declare WHAT they are.
 * Policy decides WHAT must be emitted.
 *
 * -------------------------------------------------------------------------
 * Testing Strategy
 * -------------------------------------------------------------------------
 *
 * This policy is verified by:
 *
 *   - Locked-layout equivalence tests against a golden MP4 oracle
 *   - Isolated policy tests for semantic → container-complete completion
 *   - End-to-end compiler tests ensuring correct policy invocation
 *
 * If this policy changes output bytes, tests MUST change with it.
 * Silent behavioral drift is not permitted.
 */
export function applyAvcCContainerPolicy({
    avcC,
    avcCCompleteness,
    profileIndication
}) {
    // ---------------------------------------------------------
    // Validation
    // ---------------------------------------------------------
    if (!(avcC instanceof Uint8Array)) {
        throw new Error(
            "applyAvcCContainerPolicy: avcC must be Uint8Array"
        );
    }

    if (
        avcCCompleteness !== "semantic" &&
        avcCCompleteness !== "container-complete"
    ) {
        throw new Error(
            "applyAvcCContainerPolicy: avcCCompleteness must be " +
            `"semantic" or "container-complete"`
        );
    }

    if (avcCCompleteness === "semantic") {
        if (!Number.isInteger(profileIndication)) {
            throw new Error(
                "applyAvcCContainerPolicy: profileIndication is required " +
                "when avcCCompleteness is 'semantic'"
            );
        }

        if (profileIndication < 0 || profileIndication > 255) {
            throw new Error(
                "applyAvcCContainerPolicy: profileIndication must be 0–255"
            );
        }
    }

    // ---------------------------------------------------------
    // Case 1 — Preserve historical container decisions
    // ---------------------------------------------------------
    if (avcCCompleteness === "container-complete") {
        return new Uint8Array(avcC);
    }

    // ---------------------------------------------------------
    // Case 2 — Semantic, NOT High Profile → no-op
    // ---------------------------------------------------------
    if (profileIndication < 100) {
        return new Uint8Array(avcC);
    }

    // ---------------------------------------------------------
    // Case 3 — Semantic + High Profile → append extension
    // ---------------------------------------------------------
    const extension = new Uint8Array([
        0xFC | 1, // chroma_format_idc = 1 (4:2:0)
        0xF8 | 0, // bit_depth_luma_minus8 = 0
        0xF8 | 0, // bit_depth_chroma_minus8 = 0
        0x00
    ]);

    const out = new Uint8Array(avcC.length + extension.length);
    out.set(avcC, 0);
    out.set(extension, avcC.length);

    return out;
}
