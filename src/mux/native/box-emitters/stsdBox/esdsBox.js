/**
 * esds — Elementary Stream Descriptor Box
 * =======================================
 *
 * The esds box is a **codec-owned decoder configuration record**.
 *
 * It is the *audio-track counterpart* to `avcC` in video tracks.
 *
 * Like avcC:
 * ----------
 * - esds is NOT interpreted by the MP4 container
 * - esds payload semantics are owned by the codec specification
 * - esds contents must be preserved byte-for-byte
 *
 * Unlike typical MP4 boxes:
 * --------------------------
 * - esds payload is NOT a simple fixed-field structure
 * - it contains a descriptor graph defined by ISO/IEC 14496-1
 * - the MP4 container MUST NOT parse or normalize it
 *
 * Framesmith policy (non-negotiable):
 * ----------------------------------
 * Framesmith treats esds as an **opaque payload**.
 *
 * Correctness is defined by:
 *   - correct box framing
 *   - correct payload placement
 *   - byte-for-byte preservation
 *
 * Framesmith must NOT:
 *   - parse ES_Descriptor trees
 *   - interpret AudioSpecificConfig
 *   - infer codec parameters
 *   - rewrite descriptor lengths
 *
 * Any mutation of esds bytes is a muxer bug.
 *
 * Architectural parallel:
 * -----------------------
 * avcC (video)  ⇔  esds (audio)
 *
 * Both belong to the same class:
 *
 *   “Codec-owned configuration boxes that are opaque to the MP4 container.”
 *
 * This test suite mirrors `test_avcC.js` exactly in intent and rigor.
 */
export function emitEsdsBox(params) {
    if (!params || typeof params !== "object") {
        throw new Error("emitEsdsBox: parameter object is required");
    }

    // ------------------------------------------------------------------
    // Explicit, closed contract
    // ------------------------------------------------------------------

    const allowedKeys = ["esds"];

    for (const key of Object.keys(params)) {
        if (!allowedKeys.includes(key)) {
            throw new Error(
                `emitEsdsBox: unknown parameter '${key}'`
            );
        }
    }

    if (!("esds" in params)) {
        throw new Error(
            "emitEsdsBox: missing required parameter 'esds'"
        );
    }

    const { esds } = params;

    // ------------------------------------------------------------------
    // Payload validation (structure only)
    // ------------------------------------------------------------------

    if (!(esds instanceof Uint8Array) || esds.length === 0) {
        throw new Error(
            "emitEsdsBox: esds must be a non-empty Uint8Array"
        );
    }

    /**
     * IMPORTANT:
     * ----------
     * We copy the payload defensively to guarantee immutability.
     *
     * The MP4 container must not observe later mutations to the
     * input buffer.
     */
    const payload = new Uint8Array(esds);

    // ------------------------------------------------------------------
    // Emit esds FullBox
    // ------------------------------------------------------------------

    return {
        type: "esds",

        // FullBox header
        version: 0,
        flags: 0,

        body: [
            /**
             * Raw Elementary Stream Descriptor bytes.
             *
             * Defined by ISO/IEC 14496-1.
             * Opaque to the MP4 container.
             */
            {
                array: "byte",
                values: Array.from(payload)
            }
        ]
    };
}
