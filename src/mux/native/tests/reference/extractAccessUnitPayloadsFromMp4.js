import { extractBoxByPathFromMp4 } from "./BoxExtractor.js";
import { readUint32 } from "../../bytes/mp4ByteReader.js";

/**
 * Extract access-unit byte payloads from a golden MP4.
 *
 * TEST / ORACLE ONLY
 *
 * Responsibilities:
 *   - read stsz to obtain per-sample byte sizes
 *   - slice mdat payload accordingly
 *   - return payloads indexed by sample order
 *
 * Non-responsibilities:
 *   - no timing
 *   - no keyframe logic
 *   - no MP4 assembly knowledge
 *
 * Output:
 *   Uint8Array[]  // index === sampleIndex
 */
export function extractAccessUnitPayloadsFromMp4({ mp4Bytes }) {

    if (!(mp4Bytes instanceof Uint8Array)) {
        throw new Error(
            "extractAccessUnitPayloadsFromMp4: mp4Bytes must be Uint8Array"
        );
    }

    // ---------------------------------------------------------
    // mdat
    // ---------------------------------------------------------
    const mdatBytes = extractBoxByPathFromMp4(mp4Bytes, "mdat");
    if (!mdatBytes) {
        throw new Error(
            "extractAccessUnitPayloadsFromMp4: mdat not found"
        );
    }

    const mdatPayload = mdatBytes.slice(8);

    // ---------------------------------------------------------
    // stsz
    // ---------------------------------------------------------
    const stszBytes = extractBoxByPathFromMp4(
        mp4Bytes,
        "moov/trak/mdia/minf/stbl/stsz"
    );

    if (!stszBytes) {
        throw new Error(
            "extractAccessUnitPayloadsFromMp4: stsz not found"
        );
    }

    const fixedSampleSize = readUint32(stszBytes, 12);
    const sampleCount     = readUint32(stszBytes, 16);

    if (fixedSampleSize !== 0) {
        throw new Error(
            "extractAccessUnitPayloadsFromMp4: fixed-size stsz not supported"
        );
    }

    // ---------------------------------------------------------
    // Read per-sample sizes
    // ---------------------------------------------------------
    const sizes = [];
    let offset = 20;

    for (let i = 0; i < sampleCount; i++) {
        sizes.push(readUint32(stszBytes, offset));
        offset += 4;
    }

    // ---------------------------------------------------------
    // Slice payload
    // ---------------------------------------------------------
    const payloads = [];
    let cursor = 0;

    for (let i = 0; i < sizes.length; i++) {
        const size = sizes[i];

        payloads.push(
            mdatPayload.slice(cursor, cursor + size)
        );

        cursor += size;
    }

    if (cursor !== mdatPayload.length) {
        throw new Error(
            "extractAccessUnitPayloadsFromMp4: mdat payload size mismatch"
        );
    }

    return payloads;
}
