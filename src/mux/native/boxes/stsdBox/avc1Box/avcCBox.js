import { writeUint32, writeString } from "../../../binary/Writer.js";

/**
 * avcC — AVC Decoder Configuration Record box
 *
 * The payload `avcC` already contains a complete AVCDecoderConfigurationRecord.
 */
export function buildAvcCBox({ avcC }) {

    console.log("BOX-TRACE avcC: start");
    console.log("BOX-TRACE avcC: incoming avcC length =", avcC.length);
    console.log("BOX-TRACE avcC: first 16 bytes =", Array.from(avcC.slice(0, 16)));

    const out = new Uint8Array(8 + avcC.length);

    // DEBUG: check avcC MP4 box length vs size field
    console.log("DEBUG avcC BOX LENGTH =", out.length);
    console.log("DEBUG avcC SIZE FIELD =",
        (out[0]<<24)|(out[1]<<16)|(out[2]<<8)|out[3]);

    writeUint32(out, 0, out.length);
    writeString(out, 4, "avcC");

    out.set(avcC, 8);

    console.log("BOX-TRACE avcC: final size =", out.length);

    return out;
}
