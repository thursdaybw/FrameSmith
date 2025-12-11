import { writeUint32, writeString } from "../binary/Writer.js";
import { buildAvc1Box } from "./stsdBox/avc1Box.js";

/**
 * STSD — Sample Description Box
 *
 * Responsibilities:
 *   - Declare the number of sample entries (always 1 for simple H.264 video)
 *   - Wrap the sample entry payload (e.g., avc1)
 *
 * This box does NOT decide *what* the sample entry is.
 * That responsibility belongs to the specific sample entry builder.
 */
export function buildStsdBox({ width, height, codec, avcC }) {

    console.log("BOX-TRACE stsd: start");
    console.log("BOX-TRACE stsd: codec =", codec);
    console.log("BOX-TRACE stsd: avcC length =", avcC ? avcC.length : "null");
    console.log("BOX-TRACE stsd: avcC first 16 =", avcC ? Array.from(avcC.slice(0, 16)) : "null");
    console.log("BOX-TRACE stsd: avcC FULL =", Array.from(avcC));

    // Leaf produces avc1 → avcC
    const avc1 = buildAvc1Box({ width, height, codec, avcC });

    // version(1) + flags(3) + entry_count(4)
    const header = new Uint8Array(8);
    header[0] = 0;      // version
    header[1] = 0;      // flags
    header[2] = 0;
    header[3] = 0;
    header[7] = 1;      // entry_count = 1

    const totalSize = 8      // box header
                    + 4      // version/flags
                    + 4      // entry_count
                    + avc1.length;

    const out = new Uint8Array(8 + header.length + avc1.length);

    // DEBUG: verify stsd box declared size vs actual size
    console.log("DEBUG STSD EXPECTED LENGTH =", 8 + header.length + avc1.length);
    console.log("DEBUG STSD ACTUAL LENGTH   =", out.length);

    // write box header
    writeUint32(out, 0, out.length);
    writeString(out, 4, "stsd");

    // payload
    out.set(header, 8);
    out.set(avc1, 16);

    return out;
}
