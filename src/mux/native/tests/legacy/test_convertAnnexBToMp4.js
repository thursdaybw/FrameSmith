import { convertAnnexBToMp4 } from "../convertAnnexBToMp4.js";

export function test_convertAnnexBToMp4() {
    console.log("=== test_convertAnnexBToMp4 ===");

    // two NAL units with Annex-B start codes
    const annexB = new Uint8Array([
        0x00,0x00,0x00,0x01,   // start
        0x67,0x42,0xc0,0x0b,   // SPS header
        0xaa,0xbb,0xcc,        // payload
        0x00,0x00,0x01,        // next start
        0x68,0xce,0x3c,0x80    // PPS
    ]);

    const out = convertAnnexBToMp4(annexB);

    console.log("OUT:", Array.from(out));

    // first NAL: length 3 + 4 bytes = 7
    const firstLength = (out[0]<<24)|(out[1]<<16)|(out[2]<<8)|out[3];
    if (firstLength !== 7) throw new Error("FAIL: wrong length for first NAL");

    // second NAL: length 4
    const secondLength = (out[4+7]<<24)|(out[5+7]<<16)|(out[6+7]<<8)|out[7+7];
    if (secondLength !== 4) throw new Error("FAIL: wrong length for second NAL");

    console.log("PASS: convertAnnexBToMp4");
}
