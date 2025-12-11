import { writeUint32, writeString } from "../../binary/Writer.js";
import { buildAvcCBox } from "./avc1Box/avcCBox.js";

/**
 * AVC1 Sample Entry
 *
 * Wraps codec + width + height + decoder config.
 */
export function buildAvc1Box({ width, height, codec, avcC }) {

    const avcCBox = buildAvcCBox({ avcC });

    const fixedFields = new Uint8Array(78);
    // reserved(6) = 0
    // data_reference_index(2) = 1
    fixedFields[6] = 0;
    fixedFields[7] = 1;

    // pre_defined + reserved (16 bytes) = zeroes

    // width/height
    fixedFields[24] = (width >> 8) & 0xff;
    fixedFields[25] = width & 0xff;
    fixedFields[26] = (height >> 8) & 0xff;
    fixedFields[27] = height & 0xff;

    // horizresolution(4), vertresolution(4), reserved(4), frame_count(2)
    // leave defaults, set frame_count = 1
    fixedFields[40] = 0;
    fixedFields[41] = 1;

    // compressorname (32 bytes) — empty

    const out = new Uint8Array(8 + fixedFields.length + avcCBox.length);

    // DEBUG: check avc1 length vs size field
    console.log("DEBUG AVC1 LENGTH =", out.length);
    console.log("DEBUG AVC1 SIZE FIELD =",
        (out[0]<<24)|(out[1]<<16)|(out[2]<<8)|out[3]);


    writeUint32(out, 0, out.length);
    writeString(out, 4, "avc1");

    out.set(fixedFields, 8);
    out.set(avcCBox, 8 + fixedFields.length);

    return out;
}
