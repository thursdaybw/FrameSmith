export function createMp4ByteSourceFromUint8Array({ mp4Bytes }) {
    if (!(mp4Bytes instanceof Uint8Array)) {
        throw new Error("createMp4ByteSourceFromUint8Array: mp4Bytes must be Uint8Array");
    }

    return {
        kind: "in_memory_uint8array",
        sizeBytes: mp4Bytes.length,
        async readRange({ offset, length }) {
            if (!Number.isInteger(offset) || offset < 0) {
                throw new Error("Mp4ByteSource.readRange: offset must be a non-negative integer");
            }
            if (!Number.isInteger(length) || length < 0) {
                throw new Error("Mp4ByteSource.readRange: length must be a non-negative integer");
            }
            const endExclusive = offset + length;
            if (endExclusive > mp4Bytes.length) {
                throw new Error(
                    `Mp4ByteSource.readRange: out of bounds (offset=${offset}, length=${length}, size=${mp4Bytes.length})`
                );
            }
            return mp4Bytes.slice(offset, endExclusive);
        },
        async readAll() {
            return mp4Bytes;
        }
    };
}

export function assertIsMp4ByteSource(mp4ByteSource) {
    if (!mp4ByteSource || typeof mp4ByteSource !== "object") {
        throw new Error("assertIsMp4ByteSource: mp4ByteSource must be an object");
    }
    if (!Number.isInteger(mp4ByteSource.sizeBytes) || mp4ByteSource.sizeBytes < 0) {
        throw new Error("assertIsMp4ByteSource: sizeBytes must be a non-negative integer");
    }
    if (typeof mp4ByteSource.readRange !== "function") {
        throw new Error("assertIsMp4ByteSource: readRange must be a function");
    }
    if (typeof mp4ByteSource.readAll !== "function") {
        throw new Error("assertIsMp4ByteSource: readAll must be a function");
    }
}

