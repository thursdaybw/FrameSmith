/**
 * avcC — AVC Configuration Box
 * ============================
 *
 * Golden truth extractor for avcC.
 *
 * avcC is treated as an opaque payload:
 * - no semantic parsing
 * - no normalization
 * - payload is owned by the encoder
 *
 * This extractor exists solely to:
 * - capture authoritative bytes from a golden MP4
 * - provide exact emitter input for locked-layout tests
 */

function readAvcCBoxFields(boxBytes) {
    // Structural guard only
    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error("avcC.readFields: expected Uint8Array");
    }

    return {
        raw: boxBytes
    };
}

function getAvcCEmitterInputFromBox(boxBytes) {
    return {
        avcC: boxBytes.slice(8) // strip MP4 header
    };
}

export function registerAvcCGoldenTruthExtractor(register) {
    register.readFields(readAvcCBoxFields);
    register.getBuilderInput(getAvcCEmitterInputFromBox);
}
