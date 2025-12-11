import { writeUint32, writeUint16, writeString } from "../binary/Writer.js";

/**
 * MDHD — Media Header Box (version 0)
 *
 * Responsibilities:
 *   - Declare timescale of this media
 *   - Declare duration in that timescale
 *   - Provide default language ('und')
 *
 * This is a leaf box. It encodes a fixed 24-byte payload:
 *
 *   version(1)
 *   flags(3)
 *   creation_time(4)
 *   modification_time(4)
 *   timescale(4)
 *   duration(4)
 *   language(2)
 *   pre_defined(2)
 *
 * Total size = 8-byte header + 24-byte body = 32 bytes.
 */
export function buildMdhdBox({ timescale, duration }) {

    // 32 bytes total: header(8) + body(24)
    const out = new Uint8Array(32);

    // -------------------------------------------------------------
    // Box header
    // -------------------------------------------------------------
    writeUint32(out, 0, out.length);
    writeString(out, 4, "mdhd");

    // -------------------------------------------------------------
    // version(1) + flags(3)
    // version = 0, flags = 0
    // -------------------------------------------------------------
    out[8]  = 0;
    out[9]  = 0;
    out[10] = 0;
    out[11] = 0;

    // -------------------------------------------------------------
    // creation_time (4) = 0
    // modification_time (4) = 0
    // -------------------------------------------------------------
    writeUint32(out, 12, 0);
    writeUint32(out, 16, 0);

    // -------------------------------------------------------------
    // timescale (4)
    // duration  (4)
    // -------------------------------------------------------------
    writeUint32(out, 20, timescale >>> 0);
    writeUint32(out, 24, duration  >>> 0);

    // -------------------------------------------------------------
    // language (2) — ISO-639-2/T packed value for "und"
    // pre_defined (2) = 0
    //
    // "und" encodes to 0x55C4
    // -------------------------------------------------------------
    writeUint16(out, 28, 0x55c4);
    writeUint16(out, 30, 0);

    return out;
}
