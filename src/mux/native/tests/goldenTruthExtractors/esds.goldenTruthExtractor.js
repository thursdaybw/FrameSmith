/**
 * esds — Elementary Stream Descriptor Box
 * ======================================
 *
 * Golden truth extractor for esds.
 *
 * esds is a codec-owned configuration box defined by ISO/IEC 14496-1.
 * The MP4 container does not interpret its contents.
 *
 * Framesmith policy:
 * ------------------
 * esds is treated as an opaque payload.
 *
 * This extractor:
 *   - performs no semantic parsing
 *   - performs no validation beyond structure
 *   - preserves bytes exactly
 *
 * Architectural parallel:
 * -----------------------
 *   avcC (video) ⇔ esds (audio)
 */

function readEsdsBoxFields(boxBytes) {
    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error("esds.readFields: expected Uint8Array");
    }

    return {
        raw: boxBytes
    };
}

function getEsdsEmitterInputFromBox(boxBytes) {
    return {
        // Strip FullBox header:
        // size (4) + type (4) + version/flags (4)
        esds: boxBytes.slice(12)
    };
}

export function registerEsdsGoldenTruthExtractor(register) {
    register.readFields(readEsdsBoxFields);
    register.getBuilderInput(getEsdsEmitterInputFromBox);
}
