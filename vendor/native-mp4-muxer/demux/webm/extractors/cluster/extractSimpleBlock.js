import { readVint } from "../../ebml/byteReaders/readVint.js";
import { WEBM_ELEMENT_IDS } from "../../ebml/webmElementIds.js";

function readSignedInt16BE(bytes, offset) {
    const value = (bytes[offset] << 8) | bytes[offset + 1];
    return value & 0x8000 ? value - 0x10000 : value;
}

function decodeLacingMode(flagsByte) {
    const lacingBits = (flagsByte & 0x06) >> 1;
    if (lacingBits === 0) return "none";
    if (lacingBits === 1) return "xiph";
    if (lacingBits === 2) return "fixed";
    return "ebml";
}

export function extractSimpleBlock({ bytes, element }) {
    if (!(bytes instanceof Uint8Array)) {
        throw new Error("extractSimpleBlock: bytes must be Uint8Array");
    }
    if (!element || (element.id !== WEBM_ELEMENT_IDS.SIMPLE_BLOCK && element.id !== WEBM_ELEMENT_IDS.BLOCK)) {
        throw new Error("extractSimpleBlock: element must be SIMPLE_BLOCK or BLOCK");
    }

    const payloadOffset = element.dataOffset;
    const payloadEndOffset = element.dataEndOffset;
    if (payloadOffset + 4 > payloadEndOffset) {
        throw new Error("extractSimpleBlock: payload too small for SimpleBlock header");
    }

    const trackVint = readVint(bytes, payloadOffset, {
        preserveLengthBit: false,
        maxLength: 4
    });

    const timecodeOffset = trackVint.nextOffset;
    if (timecodeOffset + 3 > payloadEndOffset) {
        throw new Error("extractSimpleBlock: payload too small after track number");
    }

    const relativeTimecode = readSignedInt16BE(bytes, timecodeOffset);
    const flags = bytes[timecodeOffset + 2];
    const blockHeaderLength = trackVint.length + 2 + 1;
    const payloadDataOffset = payloadOffset + blockHeaderLength;
    const payloadSize = payloadEndOffset - payloadDataOffset;

    return {
        trackNumber: trackVint.value,
        relativeTimecode,
        keyframe: (flags & 0x80) !== 0,
        invisible: (flags & 0x08) !== 0,
        discardable: (flags & 0x01) !== 0,
        lacingMode: decodeLacingMode(flags),
        headerLength: blockHeaderLength,
        payloadOffset: payloadDataOffset,
        payloadSize,
        payloadBytes: bytes.slice(payloadDataOffset, payloadEndOffset)
    };
}
