import { readVint } from "./readVint.js";

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
    const sizeField = readVint(bytes, sizeFieldOffset, {
        preserveLengthBit: false,
        maxLength: 8
    });
    const unknownSize = isUnknownSizeVint(bytes, sizeFieldOffset, sizeField.length);

    const dataOffset = sizeField.nextOffset;
    const dataEndOffset = dataOffset + sizeField.value;
    if (dataEndOffset > bytes.length) {
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
        nextOffset: dataEndOffset,
        unknownSize
    };
}

