import { writeUint32, writeString } from "../binary/Writer.js";

/**
 * TKHD — Track Header Box
 *
 * Responsibilities:
 *   - Identify the track (trackId = 1 for simple video)
 *   - Declare duration in movie timescale units
 *   - Declare width/height in 16.16 fixed point
 *
 * This is a fixed-structure leaf box. No children.
 * Many fields are constant in this muxer:
 *   - creation_time = 0
 *   - modification_time = 0
 *   - layer = 0
 *   - alternate_group = 0
 *   - volume = 0 (video)
 *   - matrix = identity
 */
export function buildTkhdBox({ width, height, duration }) {

    // Offsets follow ISO BMFF tkhd full-box version 0 layout.
    // Total size is fixed at 92 bytes for this minimal implementation.
    const out = new Uint8Array(92);

    // -------------------------------------------------------------
    // Box header
    // -------------------------------------------------------------
    writeUint32(out, 0, out.length);
    writeString(out, 4, "tkhd");

    // -------------------------------------------------------------
    // version + flags
    // version = 0
    // flags = 0x000007   (track enabled | in movie | in preview)
    // -------------------------------------------------------------
    out[8] = 0;
    out[9] = 0;
    out[10] = 0;
    out[11] = 7;

    // -------------------------------------------------------------
    // creation_time (4 bytes)
    // modification_time (4 bytes)
    // track_ID (4 bytes)
    // reserved (4 bytes)
    // -------------------------------------------------------------
    // creation_time = 0
    // modification_time = 0
    // track_ID = 1
    // reserved = 0
    writeUint32(out, 12, 0);
    writeUint32(out, 16, 0);
    writeUint32(out, 20, 1);
    writeUint32(out, 24, 0);

    // -------------------------------------------------------------
    // duration (4 bytes)
    // -------------------------------------------------------------
    writeUint32(out, 28, duration >>> 0);

    // -------------------------------------------------------------
    // reserved (8 bytes)
    // layer (2 bytes)
    // alternate_group (2 bytes)
    // volume (2 bytes)
    // reserved (2 bytes)
    // -------------------------------------------------------------
    // All zero for video tracks.
    // (bytes 32–47 are already zero because Uint8Array defaults to 0)

    // -------------------------------------------------------------
    // Matrix structure (36 bytes)
    // Identity matrix:
    // [1.0  0    0
    //  0    1.0  0
    //  0    0    1.0]
    //
    // Each element is 16.16 fixed point:
    //   1.0 → 0x00010000
    // -------------------------------------------------------------
    const one = 0x00010000;

    writeUint32(out, 48,  one);
    writeUint32(out, 52,  0);
    writeUint32(out, 56,  0);

    writeUint32(out, 60,  0);
    writeUint32(out, 64,  one);
    writeUint32(out, 68,  0);

    writeUint32(out, 72,  0);
    writeUint32(out, 76,  one);
    writeUint32(out, 80,  0);

    // -------------------------------------------------------------
    // width / height (each 16.16 fixed point)
    // -------------------------------------------------------------
    const widthFixed  = width << 16;
    const heightFixed = height << 16;

    writeUint32(out, 84, widthFixed >>> 0);
    writeUint32(out, 88, heightFixed >>> 0);

    return out;
}
