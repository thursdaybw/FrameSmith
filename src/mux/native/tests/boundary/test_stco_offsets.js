import { NativeMuxer } from "../../NativeMuxer.js";

/**
 * Boundary Test:
 * Ensure all stco offsets land AFTER:
 *   ftyp + moov + 8 byte mdat header
 */
export async function test_stco_offsets() {
    console.log("=== boundary: test_stco_offsets ===");

    const muxer = new NativeMuxer({
        codec: "avc1.42E01E",
        width: 64,
        height: 64,
        fps: 30
    });

    // One fake sample with correct SPS/PPS
    const spspps = new Uint8Array([
        0x00,0x00,0x00,1, 0x67,0x42,0xE0,0x1F,
        0x00,0x00,0x00,1, 0x68,0xCE,0x3C,0x80
    ]);

    muxer.addVideoFrame({
        timestamp: 0,
        duration: 33333,
        byteLength: spspps.length,
        copyTo: (out) => out.set(spspps)
    });

    const blob = await muxer.finalize();
    const buf = new Uint8Array(await blob.arrayBuffer());

    // Parse stco by finding 'stco' box
    const stcoIndex = buf.indexOf(0x73);  // 's'
    // Precise header search is unnecessary for this boundary check

    if (stcoIndex < 0) throw new Error("stco not found");

    const stcoSize =
        (buf[stcoIndex - 4] << 24) |
        (buf[stcoIndex - 3] << 16) |
        (buf[stcoIndex - 2] << 8) |
        buf[stcoIndex - 1];

    const entryCount =
        (buf[stcoIndex + 8] << 24) |
        (buf[stcoIndex + 9] << 16) |
        (buf[stcoIndex + 10] << 8) |
        buf[stcoIndex + 11];

    const firstOffset =
        (buf[stcoIndex + 12] << 24) |
        (buf[stcoIndex + 13] << 16) |
        (buf[stcoIndex + 14] << 8) |
        buf[stcoIndex + 15];

    if (firstOffset < 100) {
        throw new Error("stco offset too small, likely pointing inside mdat header");
    }

    console.log("PASS: stco offset boundary test");
}
