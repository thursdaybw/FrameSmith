export function readUint32(bytes, offset) {
    return (
        (bytes[offset] << 24) |
        (bytes[offset + 1] << 16) |
        (bytes[offset + 2] << 8) |
        bytes[offset + 3]
    );
}

export function readType(bytes, offset) {
    return String.fromCharCode(
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3]
    );
}

export function readUint16(bytes, offset) {
    return (bytes[offset] << 8) | bytes[offset + 1];
}

export function writeDebugAvcC(buffer) {

    function readSize(buf, off) {
        return (buf[off]<<24) | (buf[off+1]<<16) | (buf[off+2]<<8) | buf[off+3];
    }

    function readType(buf, off) {
        return String.fromCharCode(
            buf[off+4],
            buf[off+5],
            buf[off+6],
            buf[off+7]
        );
    }

    // Walk all boxes recursively
    function walk(buf, start, end, depth) {
        let offset = start;
        while (offset < end) {
            const size = readSize(buf, offset);
            const type = readType(buf, offset);

            // Safety check
            if (size < 8) break;

            // Debug indent
            const pad = " ".repeat(depth * 2);
            // console.log(pad + "BOX", type, "size", size);

            // FOUND avcC
            if (type === "avcC") {
                const payloadStart = offset + 8;
                const payloadSize = size - 8;
                const bytes = buf.slice(payloadStart, payloadStart + payloadSize);
                console.log("DEBUG avcC payload:", bytes);
                return bytes;
            }

            // Recurse into container boxes
            const containerTypes = new Set([
                "moov", "trak", "mdia", "minf", "stbl", "stsd", "avc1"
            ]);

            // Compute the start of child boxes.
            // Most boxes start children immediately after the 8 byte header,
            // but STSD has an additional 8 bytes (version/flags + entry_count).
            let innerStart = offset + 8;

            if (type === "stsd") {
                innerStart += 8;  // skip version/flags + entry_count
            }

            if (type === "avc1") {
                innerStart += 78;
            }

            const innerEnd = offset + size;

            const found = walk(buf, innerStart, innerEnd, depth + 1);
            if (found) return found;


            offset += size;
        }
        return null;
    }

    // Start walking from file root
    const result = walk(buffer, 0, buffer.length, 0);

    if (!result) {
        console.warn("avcC not found");
    }

    return result;

}

