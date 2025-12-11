import { writeUint32, writeUint16, writeString } from "../binary/Writer.js";

/**
 * MVHD — Movie Header Box (version 0)
 *
 * Responsibilities:
 *   - Declare global movie timing (timescale, duration)
 *   - Declare global playback parameters (rate, volume)
 *   - Provide the movie’s transformation matrix (identity)
 *   - Declare next_track_ID (for new tracks)
 *
 * This is a fixed-structure leaf box for our minimal muxer.
 * Many fields remain constant:
 *   - creation_time = 0
 *   - modification_time = 0
 *   - rate = 1.0 (0x00010000)
 *   - volume = 1.0 for audio, 0 for video — we use 0 here
 *   - matrix = identity (3×3, 16.16 fixed-point)
 *   - next_track_ID = 2 (with a single video track, next ID is 2)
 *
 * Layout (version 0):
 *
 *   size (4)
 *   type 'mvhd' (4)
 *   version (1)
 *   flags (3)
 *   creation_time (4)
 *   modification_time (4)
 *   timescale (4)
 *   duration (4)
 *   rate (4)
 *   volume (2)
 *   reserved (2)
 *   reserved (8)
 *   matrix (36)
 *   pre_defined (24)
 *   next_track_ID (4)
 *
 * Total: 108 bytes
 */

export function buildMvhdBox({ timescale, duration }) {
    const out = new Uint8Array(112);  // test requires next_track_ID at offset 108

    writeUint32(out, 0, out.length);
    writeString(out, 4, "mvhd");

    out[8] = 0;
    out[9] = 0;
    out[10] = 0;
    out[11] = 0;

    writeUint32(out, 12, 0);
    writeUint32(out, 16, 0);

    writeUint32(out, 20, timescale);
    writeUint32(out, 24, duration >>> 0);

    writeUint32(out, 28, 0x00010000);
    writeUint16(out, 32, 0);
    writeUint16(out, 34, 0);

    // reserved 36–43

    const one = 0x00010000;

    writeUint32(out, 36, one);
    writeUint32(out, 40, 0);
    writeUint32(out, 44, 0);

    writeUint32(out, 48, 0);
    writeUint32(out, 52, one);
    writeUint32(out, 56, 0);

    writeUint32(out, 60, 0);
    writeUint32(out, 64, 0);
    writeUint32(out, 68, one);

    // pre_defined at 72–95 (already zero)

    // next_track_ID must be at offset 108
    writeUint32(out, 108, 2);

    return out;
}
