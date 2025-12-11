import { convertAnnexBToMp4 } from "../../convertAnnexBToMp4.js";

/**
 * Boundary Test:
 * Ensure NAL unit extraction is reversible:
 * MP4 → AnnexB → MP4 yields identical NAL payloads.
 */
export async function test_roundtrip_nalu() {
    console.log("=== boundary: test_roundtrip_nalu ===");

    const annexB = new Uint8Array([
        0x00,0x00,0x00,1, 0x67,0x42,0xE0,0x1F,
        0x00,0x00,0x00,1, 0x68,0xCE,0x3C,0x80
    ]);

    const mp4 = convertAnnexBToMp4(annexB);

    // Now rebuild annexB from MP4 encoded form
    let out = [];
    let pos = 0;

    while (pos < mp4.length) {
        const size =
            (mp4[pos] << 24) |
            (mp4[pos+1] << 16) |
            (mp4[pos+2] << 8) |
            mp4[pos+3];

        const start = pos + 4;
        const end = start + size;

        out.push(0x00,0x00,0x00,1);

        for (let i = start; i < end; i++) {
            out.push(mp4[i]);
        }

        pos = end;
    }

    const rebuilt = new Uint8Array(out);

    if (rebuilt.length !== annexB.length) {
        throw new Error("Roundtrip size mismatch");
    }

    for (let i = 0; i < annexB.length; i++) {
        if (rebuilt[i] !== annexB[i]) {
            throw new Error("Roundtrip NAL mismatch at byte " + i);
        }
    }

    console.log("PASS: roundtrip NAL test");
}
