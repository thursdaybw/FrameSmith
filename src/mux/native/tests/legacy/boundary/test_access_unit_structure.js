// boundary/test_access_unit_structure.js

import { convertAnnexBToMp4 } from "../../convertAnnexBToMp4.js";

/**
 * Boundary Test:
 * Ensure that each NAL unit in Annex B format becomes:
 *   [4-byte length][NAL payload]
 * and that no start codes survive.
 */
export async function test_access_unit_structure() {
    console.log("=== boundary: test_access_unit_structure ===");

    const sample = new Uint8Array([
        0x00,0x00,0x00,1, 0x67,0x42,0xE0,0x1F,  // SPS
        0x00,0x00,0x00,1, 0x68,0xCE,0x3C,0x80   // PPS
    ]);

    const mp4 = convertAnnexBToMp4(sample);

    let offset = 0;
    let index = 0;

    while (offset < mp4.length) {

        // Read length prefix
        const size =
            (mp4[offset] << 24) |
            (mp4[offset+1] << 16) |
            (mp4[offset+2] << 8) |
            mp4[offset+3];

        if (size <= 0) {
            throw new Error(`Invalid NAL size at index ${index}`);
        }

        const nalStart = offset + 4;
        const nalEnd = nalStart + size;

        // Ensure NAL does not include any start codes
        for (let i = nalStart; i < nalEnd - 3; i++) {
            if (
                mp4[i] === 0 &&
                mp4[i+1] === 0 &&
                mp4[i+2] === 0 &&
                mp4[i+3] === 1
            ) {
                throw new Error(
                    `Start code leaked into MP4 NAL at index ${index}`
                );
            }
        }

        offset = nalEnd;
        index++;
    }

    console.log("PASS: access unit structure test");
}

