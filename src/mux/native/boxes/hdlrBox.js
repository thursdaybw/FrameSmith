import { writeUint32, writeString } from "../binary/Writer.js";

/**
 * HDLR — Handler Reference Box
 *
 * Minimal video handler:
 *   handler_type = "vide"
 *   name = "VideoHandler"
 */
export function buildHdlrBox() {

    const name = "VideoHandler";
    const nameBytes = new TextEncoder().encode(name + "\0");

    // Compute base size (32 bytes of fixed fields + name)
    let boxSize = 32 + nameBytes.length;

    // Pad to a 4-byte boundary so that traversal via p += size stays aligned
    const paddedSize = (boxSize + 3) & ~3;

    const out = new Uint8Array(paddedSize);

    // Write 32-bit size
    writeUint32(out, 0, paddedSize);

    // Write type 'hdlr'
    writeString(out, 4, "hdlr");

    // version / flags
    out[8] = 0;
    out[9] = 0;
    out[10] = 0;
    out[11] = 0;

    // pre_defined = 0
    writeUint32(out, 12, 0);

    // handler_type = 'vide'
    writeString(out, 16, "vide");

    // reserved (12 bytes) already zero

    // name (null-terminated)
    out.set(nameBytes, 32);

    return out;
}
