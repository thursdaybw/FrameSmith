export function readEbmlString(bytes, offset, length) {
    if (!(bytes instanceof Uint8Array)) {
        throw new Error("readEbmlString: bytes must be Uint8Array");
    }
    if (!Number.isInteger(offset) || offset < 0) {
        throw new Error("readEbmlString: offset must be a non-negative integer");
    }
    if (!Number.isInteger(length) || length < 0) {
        throw new Error("readEbmlString: length must be a non-negative integer");
    }
    if (offset + length > bytes.length) {
        throw new Error("readEbmlString: read out of bounds");
    }

    const slice = bytes.slice(offset, offset + length);
    const decoder = new TextDecoder("utf-8");
    return decoder.decode(slice).replace(/\u0000+$/g, "");
}

