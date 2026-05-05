export function createWebmByteSourceFromUint8Array({ webmBytes }) {
    if (!(webmBytes instanceof Uint8Array)) {
        throw new Error("createWebmByteSourceFromUint8Array: webmBytes must be Uint8Array");
    }

    return {
        kind: "in_memory_uint8array",
        sizeBytes: webmBytes.length,
        async readRange({ offset, length }) {
            if (!Number.isInteger(offset) || offset < 0) {
                throw new Error("WebmByteSource.readRange: offset must be a non-negative integer");
            }
            if (!Number.isInteger(length) || length < 0) {
                throw new Error("WebmByteSource.readRange: length must be a non-negative integer");
            }
            const endExclusive = offset + length;
            if (endExclusive > webmBytes.length) {
                throw new Error(
                    `WebmByteSource.readRange: out of bounds (offset=${offset}, length=${length}, size=${webmBytes.length})`
                );
            }
            return webmBytes.slice(offset, endExclusive);
        },
        async readAll() {
            return webmBytes;
        }
    };
}

export function assertIsWebmByteSource(webmByteSource) {
    if (!webmByteSource || typeof webmByteSource !== "object") {
        throw new Error("assertIsWebmByteSource: webmByteSource must be an object");
    }
    if (!Number.isInteger(webmByteSource.sizeBytes) || webmByteSource.sizeBytes < 0) {
        throw new Error("assertIsWebmByteSource: sizeBytes must be a non-negative integer");
    }
    if (typeof webmByteSource.readRange !== "function") {
        throw new Error("assertIsWebmByteSource: readRange must be a function");
    }
    if (typeof webmByteSource.readAll !== "function") {
        throw new Error("assertIsWebmByteSource: readAll must be a function");
    }
}

