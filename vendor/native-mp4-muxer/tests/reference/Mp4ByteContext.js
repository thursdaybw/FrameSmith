import { readUint32 } from "../../bytes/mp4ByteReader.js";
import { readFourCC } from "../../box-schema/boxLayoutReaders.js";

/**
 * Walk top-level MP4 boxes and return semantic context
 * for a given absolute byte offset.
 *
 * TEST-ONLY utility.
 */
export function describeMp4Byte(mp4Bytes, offset) {
    let cursor = 0;

    while (cursor + 8 <= mp4Bytes.length) {
        const size = readUint32(mp4Bytes, cursor);
        const type = readFourCC(mp4Bytes, cursor + 4);

        if (offset >= cursor && offset < cursor + size) {
            const rel = offset - cursor;

            // Header
            if (rel < 4) {
                return {
                    box: type,
                    section: "size",
                    detail: `size byte ${rel} (big-endian)`
                };
            }

            if (rel < 8) {
                return {
                    box: type,
                    section: "type",
                    detail: `fourcc byte ${rel - 4}`
                };
            }

            // Payload
            return {
                box: type,
                section: "payload",
                detail: `payload byte ${rel - 8}`
            };
        }

        cursor += size;
    }

    return {
        box: "unknown",
        section: "unknown",
        detail: "offset outside parsed boxes"
    };
}
