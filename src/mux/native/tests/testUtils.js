/**
 * Read a 32-bit unsigned big-endian integer
 * from an MP4 box byte array.
 *
 * oldname readInt32
 */
export function readUint32FromMp4BoxBytes(boxBytes, offset) {
    return (
        (boxBytes[offset] << 24) |
        (boxBytes[offset + 1] << 16) |
        (boxBytes[offset + 2] << 8) |
        boxBytes[offset + 3]
    ) >>> 0;
}

/**
 * Read a 16-bit unsigned big-endian integer
 * from an MP4 box byte array.
 *
 * old name readShort
 */
export function readUint16FromMp4BoxBytes(boxBytes, offset) {
    return (
        (boxBytes[offset] << 8) |
        boxBytes[offset + 1]
    ) >>> 0;
}

/**
 * Read a FourCC box type from an MP4 box header.
 *
 * Expects offset to point at the *type field*,
 * not the size field.
 */
export function readBoxTypeFromMp4BoxBytes(boxBytes, offset) {
    return String.fromCharCode(
        boxBytes[offset],
        boxBytes[offset + 1],
        boxBytes[offset + 2],
        boxBytes[offset + 3]
    );
}
/**
 * Debug utility for extracting the avcC box payload from a serialized MP4.
 *
 * The walker recursively discovers boxes by reading:
 *   - box size (int32)
 *   - box type (FourCC)
 *
 * When the type "avcC" is encountered, the raw payload bytes are returned.
 */
export function writeDebugAvcC(buffer) {

    // Read 32-bit int from MP4 buffer.
    function readSize(buf, off) {
        return (
            (buf[off] << 24) |
            (buf[off + 1] << 16) |
            (buf[off + 2] << 8) |
            buf[off + 3]
        );
    }

    // Read FourCC type field.
    function readBoxType(buf, off) {
        return String.fromCharCode(
            buf[off + 4],
            buf[off + 5],
            buf[off + 6],
            buf[off + 7]
        );
    }

    // Recursive descent through container boxes.
    function walk(buf, start, end, depth) {
        let offset = start;

        while (offset < end) {

            const size = readSize(buf, offset);
            const type = readBoxType(buf, offset);

            // Safety guard
            if (size < 8) break;

            // FOUND avcC
            if (type === "avcC") {
                const payloadStart = offset + 8;
                const payloadSize = size - 8;
                return buf.slice(payloadStart, payloadStart + payloadSize);
            }

            // Containers that may contain avcC
            const containerTypes = new Set([
                "moov", "trak", "mdia", "minf", "stbl", "stsd", "avc1"
            ]);

            let innerStart = offset + 8;

            // stsd has version/flags + entry_count = additional 8 bytes
            if (type === "stsd") innerStart += 8;

            // avc1 sample entry header is 78 bytes before child boxes begin
            if (type === "avc1") innerStart += 78;

            const innerEnd = offset + size;

            if (containerTypes.has(type)) {
                const found = walk(buf, innerStart, innerEnd, depth + 1);
                if (found) return found;
            }

            offset += size;
        }

        return null;
    }

    const result = walk(buffer, 0, buffer.length, 0);

    if (!result) {
        console.warn("avcC not found");
    }

    return result;
}
