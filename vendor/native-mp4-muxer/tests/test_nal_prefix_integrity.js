import { convertAnnexBToMp4 } from "../convertAnnexBToMp4.js";

/**
 * Utility to check each NAL prefix in a converted MP4 sample
 */
function validateNalPrefixes(bytes) {
    let cursor = 0;
    const total = bytes.length;

    while (cursor + 4 <= total) {
        const len =
            (bytes[cursor] << 24) |
            (bytes[cursor + 1] << 16) |
            (bytes[cursor + 2] << 8) |
            (bytes[cursor + 3]);

        if (len < 1) {
            throw new Error(`Invalid NAL length prefix: ${len}`);
        }

        const payloadStart = cursor + 4;
        const payloadEnd = payloadStart + len;

        if (payloadEnd > total) {
            throw new Error(
                `NAL length prefix (${len}) exceeds sample size (${total - payloadStart})`
            );
        }

        cursor = payloadEnd;
    }
}

export function testNalPrefixIntegrity() {
    console.log("=== testNalPrefixIntegrity ===");

    const annexB = new Uint8Array([
        0x00,0x00,0x00,0x01, 0x67,0x42,0xC0,0x0B, 0x8C,0x68,0x42,0x49, 0xA8,0x08,0x08,0x08,
        0x3C,0x22,0x11,0xA8,

        0x00,0x00,0x00,0x01, 0x68,0xCE,0x3C,0x80,

        0x00,0x00,0x00,0x01, 0x65,0xB8, 0x00,0x04, 0x09,0xFF,0xFF,0xF8,
        0x22,0x8A, 0x00,0x02, 0x03,0xFE, 0x38,0x00, 0x08,0x09, 0xC7,0x00,
        0x01,0x0B, 0xE9,0x31, 0x59,0x39, 0x3A,0xC5, 0x6B, 0xAE,0xBA,0xEB,
        0xAE,0xBA,0xEB,0xAE,0xBC
    ]);

    const out = convertAnnexBToMp4(annexB);

    validateNalPrefixes(out);

    console.log("PASS: NAL prefix integrity test");
}
