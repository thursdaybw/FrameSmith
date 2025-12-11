import { scanAnnexB } from "./h264Scan.js";

/**
 * convertAnnexBToMp4
 * ------------------
 * Convert an Annex-B stream (with start codes) into length-prefixed NAL units.
 *
 * Input:
 *   Uint8Array (original Annex-B)
 *
 * Output:
 *   Uint8Array of MP4-style NALs:
 *       [4-byte length][raw payload]
 *
 * Important:
 *   - Uses robust scanner that avoids false boundaries
 *   - Does not alter payload bytes
 */
export function convertAnnexBToMp4(bytes) {
    const units = scanAnnexB(bytes);

    // Precompute required final size
    let total = 0;
    for (const u of units) {
        const len = u.payloadEnd - u.payloadStart;
        total += 4 + len;
    }

    const out = new Uint8Array(total);
    let cursor = 0;

    for (const u of units) {
        const len = u.payloadEnd - u.payloadStart;

        // Write length prefix
        out[cursor]     = (len >>> 24) & 0xFF;
        out[cursor + 1] = (len >>> 16) & 0xFF;
        out[cursor + 2] = (len >>> 8)  & 0xFF;
        out[cursor + 3] = len & 0xFF;
        cursor += 4;

        // Copy payload
        out.set(bytes.subarray(u.payloadStart, u.payloadEnd), cursor);
        cursor += len;
    }

    return out;
}
