/**
 * MDAT — Media Data (opaque payload)
 *
 * Emits raw media payload bytes.
 *
 * Responsibilities:
 * - Concatenate sample bytes in the given order
 * - Write size + 'mdat' header
 *
 * Non-responsibilities:
 * - No sample ordering
 * - No chunking decisions
 * - No offset computation
 * - No mutation of sample bytes
 */
export function emitMdatBytes(samples) {

    if (!Array.isArray(samples)) {
        throw new Error("emitMdatBytes: samples must be an array");
    }

    let totalBytes = 0;

    for (const s of samples) {
        if (!s || !(s.data instanceof Uint8Array)) {
            throw new Error(
                "emitMdatBytes: each sample must have a data Uint8Array"
            );
        }
        totalBytes += s.data.length;
    }

    const boxSize = 8 + totalBytes;
    const out = new Uint8Array(boxSize);

    // size
    out[0] = (boxSize >>> 24) & 0xFF;
    out[1] = (boxSize >>> 16) & 0xFF;
    out[2] = (boxSize >>> 8) & 0xFF;
    out[3] = boxSize & 0xFF;

    // 'mdat'
    out[4] = 0x6D;
    out[5] = 0x64;
    out[6] = 0x61;
    out[7] = 0x74;

    let offset = 8;
    for (const s of samples) {
        out.set(s.data, offset);
        offset += s.data.length;
    }

    return out;
}
