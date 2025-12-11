/**
 * Build an mdat box from a list of samples.
 * Each sample has:
 *   { data: Uint8Array }
 *
 * The format is:
 *   [4 bytes size]
 *   [4 bytes 'mdat']
 *   [media payload bytes...]
 */
export function buildMdatBox(samples) {

    if (!Array.isArray(samples)) {
        throw new Error("buildMdatBox: samples must be an array");
    }

    // Compute total payload size
    let totalBytes = 0;
    for (const s of samples) {
        if (!s || !(s.data instanceof Uint8Array)) {
            throw new Error("buildMdatBox: each sample must have a data Uint8Array");
        }
        totalBytes += s.data.length;
    }

    // Total size = header (8) + payload bytes
    const boxSize = 8 + totalBytes;

    // Allocate final buffer
    const out = new Uint8Array(boxSize);

    // Write 32-bit size
    out[0] = (boxSize >>> 24) & 0xFF;
    out[1] = (boxSize >>> 16) & 0xFF;
    out[2] = (boxSize >>> 8) & 0xFF;
    out[3] = (boxSize) & 0xFF;

    // Write 'mdat'
    out[4] = 0x6D; // 'm'
    out[5] = 0x64; // 'd'
    out[6] = 0x61; // 'a'
    out[7] = 0x74; // 't'

    // Copy sample bytes sequentially
    let offset = 8;
    for (const s of samples) {
        const bytes = s.data;    // do not mutate
        out.set(bytes, offset);
        offset += bytes.length;
    }

    return out;
}

