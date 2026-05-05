export function readEbmlFloat(bytes, offset, length) {
    if (!(bytes instanceof Uint8Array)) {
        throw new Error("readEbmlFloat: bytes must be Uint8Array");
    }
    if (!Number.isInteger(offset) || offset < 0) {
        throw new Error("readEbmlFloat: offset must be a non-negative integer");
    }
    if (length !== 4 && length !== 8) {
        throw new Error("readEbmlFloat: length must be 4 or 8");
    }
    if (offset + length > bytes.length) {
        throw new Error("readEbmlFloat: read out of bounds");
    }

    const view = new DataView(bytes.buffer, bytes.byteOffset + offset, length);
    if (length === 4) {
        return view.getFloat32(0, false);
    }
    return view.getFloat64(0, false);
}

