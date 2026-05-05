function resolveVintLength(firstByte) {
    let mask = 0x80;
    for (let length = 1; length <= 8; length++) {
        if ((firstByte & mask) !== 0) {
            return length;
        }
        mask = mask >> 1;
    }
    return 0;
}

export function readVint(bytes, offset = 0, options = {}) {
    if (!(bytes instanceof Uint8Array)) {
        throw new Error("readVint: bytes must be Uint8Array");
    }
    if (!Number.isInteger(offset) || offset < 0) {
        throw new Error("readVint: offset must be a non-negative integer");
    }

    const preserveLengthBit = options.preserveLengthBit === true;
    const maxLength = Number.isInteger(options.maxLength) ? options.maxLength : 8;
    if (maxLength < 1 || maxLength > 8) {
        throw new Error("readVint: maxLength must be an integer between 1 and 8");
    }
    if (offset >= bytes.length) {
        throw new Error("readVint: offset out of bounds");
    }

    const firstByte = bytes[offset];
    const length = resolveVintLength(firstByte);
    if (length === 0) {
        throw new Error("readVint: invalid VINT (first byte has no leading marker bit)");
    }
    if (length > maxLength) {
        throw new Error(`readVint: VINT length ${length} exceeds maxLength ${maxLength}`);
    }
    if (offset + length > bytes.length) {
        throw new Error("readVint: truncated VINT");
    }

    let initialValueByte = firstByte;
    if (!preserveLengthBit) {
        const valueMask = (1 << (8 - length)) - 1;
        initialValueByte = firstByte & valueMask;
    }

    let valueBigInt = BigInt(initialValueByte);
    for (let i = 1; i < length; i++) {
        valueBigInt = (valueBigInt << 8n) | BigInt(bytes[offset + i]);
    }

    const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
    if (valueBigInt > maxSafe) {
        throw new Error("readVint: value exceeds Number.MAX_SAFE_INTEGER");
    }

    return {
        length,
        value: Number(valueBigInt),
        offset,
        nextOffset: offset + length
    };
}

