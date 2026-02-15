export function readUnsignedInteger(bytes, offset, length) {
    if (!(bytes instanceof Uint8Array)) {
        throw new Error("readUnsignedInteger: bytes must be Uint8Array");
    }
    if (!Number.isInteger(offset) || offset < 0) {
        throw new Error("readUnsignedInteger: offset must be a non-negative integer");
    }
    if (!Number.isInteger(length) || length < 1 || length > 8) {
        throw new Error("readUnsignedInteger: length must be an integer between 1 and 8");
    }
    if (offset + length > bytes.length) {
        throw new Error("readUnsignedInteger: read out of bounds");
    }

    let valueBigInt = 0n;
    for (let i = 0; i < length; i++) {
        valueBigInt = (valueBigInt << 8n) | BigInt(bytes[offset + i]);
    }

    const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
    if (valueBigInt > maxSafe) {
        throw new Error("readUnsignedInteger: value exceeds Number.MAX_SAFE_INTEGER");
    }
    return Number(valueBigInt);
}

