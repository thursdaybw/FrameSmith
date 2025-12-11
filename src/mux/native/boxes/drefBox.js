import { writeUint32, writeString } from "../binary/Writer.js";

/**
 * buildDrefBox
 *
 * dref box structure (ISO/IEC 14496-12):
 *
 * dref
 *   version = 0
 *   flags = 0
 *   entry_count = 1
 *   url  box (version=0, flags=1)
 */
export function buildDrefBox() {

    // url box: 4(size) + 4(type) + 1(version) + 3(flags) = 12 bytes
    const urlSize = 12;

    // dref: 4(size) + 4(type) + 1(version) + 3(flags) + 4(entry_count) + urlSize
    const drefSize = 8 + 4 + urlSize;

    const out = new Uint8Array(drefSize);

    // dref header
    writeUint32(out, 0, drefSize);
    writeString(out, 4, "dref");

    // version = 0
    out[8] = 0;

    // flags = 0,0,0
    out[9] = 0;
    out[10] = 0;
    out[11] = 0;

    // entry_count = 1
    writeUint32(out, 12, 1);

    // url box
    writeUint32(out, 16, urlSize);
    writeString(out, 20, "url ");

    // url version = 0
    out[24] = 0;

    // url flags = 0,0,1 (self-contained)
    out[25] = 0;
    out[26] = 0;
    out[27] = 1;

    return out;
}
