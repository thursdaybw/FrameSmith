import { writeUint32, writeString } from "../binary/Writer.js";

/**
 * VMHD — Video Media Header Box
 *
 * Minimal version:
 *   graphicsmode = 0
 *   opcolor = {0,0,0}
 */
export function buildVmhdBox() {

    const boxSize = 20;
    const out = new Uint8Array(boxSize);

    writeUint32(out, 0, boxSize);
    writeString(out, 4, "vmhd");

    // version = 0
    out[8] = 0;

    // flags = 1 (ISO spec requires this)
    out[11] = 1;

    // graphicsmode = 0, opcolor = 0,0,0
    // already zeroed

    return out;
}
