import { readVint } from "./readVint.js";

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

function isUnknownSizeVint(bytes, offset, length) {
    const firstByte = bytes[offset];
    const valueMask = (1 << (8 - length)) - 1;
    if ((firstByte & valueMask) !== valueMask) {
        return false;
    }
    for (let i = 1; i < length; i++) {
        if (bytes[offset + i] !== 0xff) {
            return false;
        }
    }
    return true;
}

function readSizeField(bytes, offset) {
    const firstByte = bytes[offset];
    const length = resolveVintLength(firstByte);
    if (length === 0) {
        throw new Error("readElementHeader: invalid size VINT (first byte has no leading marker bit)");
    }
    if (offset + length > bytes.length) {
        throw new Error("readElementHeader: truncated size VINT");
    }

    const unknownSize = isUnknownSizeVint(bytes, offset, length);
    if (unknownSize) {
        return {
            length,
            value: null,
            nextOffset: offset + length,
            unknownSize: true
        };
    }

    const valueMask = (1 << (8 - length)) - 1;
    let valueBigInt = BigInt(firstByte & valueMask);
    for (let i = 1; i < length; i++) {
        valueBigInt = (valueBigInt << 8n) | BigInt(bytes[offset + i]);
    }

    const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
    if (valueBigInt > maxSafe) {
        throw new Error("readElementHeader: size value exceeds Number.MAX_SAFE_INTEGER");
    }

    return {
        length,
        value: Number(valueBigInt),
        nextOffset: offset + length,
        unknownSize: false
    };
}

export function readElementHeader(bytes, offset = 0) {
    if (!(bytes instanceof Uint8Array)) {
        throw new Error("readElementHeader: bytes must be Uint8Array");
    }
    if (!Number.isInteger(offset) || offset < 0) {
        throw new Error("readElementHeader: offset must be a non-negative integer");
    }
    if (offset >= bytes.length) {
        throw new Error("readElementHeader: offset out of bounds");
    }

    const idField = readVint(bytes, offset, {
        preserveLengthBit: true,
        maxLength: 4
    });

    const sizeFieldOffset = idField.nextOffset;
    const sizeField = readSizeField(bytes, sizeFieldOffset);
    const unknownSize = sizeField.unknownSize;

    const dataOffset = sizeField.nextOffset;
    let dataEndOffset = dataOffset + sizeField.value;
    if (unknownSize) {
        dataEndOffset = null;
    } else if (dataEndOffset > bytes.length) {
        throw new Error(
            `readElementHeader: element exceeds buffer (offset=${offset}, id=0x${idField.value.toString(16)}, size=${sizeField.value})`
        );
    }

    return {
        offset,
        id: idField.value,
        idLength: idField.length,
        size: sizeField.value,
        sizeLength: sizeField.length,
        headerLength: idField.length + sizeField.length,
        dataOffset,
        dataEndOffset,
        nextOffset: unknownSize ? null : dataEndOffset,
        unknownSize
    };
}
