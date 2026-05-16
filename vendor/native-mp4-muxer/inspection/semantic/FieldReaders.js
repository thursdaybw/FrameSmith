/**
 * Semantic Field Readers (INSPECTION ONLY)
 *
 * Responsibility:
 * - Interpret MP4 box payload bytes into named, human-readable fields
 *
 * Non-responsibilities:
 * - Traversal
 * - Validation
 * - Assertions
 * - Diffing
 * - Policy
 *
 * These readers:
 * - assume structurally valid input
 * - may assume FFmpeg-style layout
 * - are incomplete by design
 *
 * They exist to support:
 * - inspection tests
 * - oracle comparison
 * - debugging
 *
 * They must NOT be used by production code.
 */

import {
  readUint16BE,
  readUint32BE
} from "../../bytes/mp4ByteReader.js";

export function readAscii(bytes, offset, length) {
    return String.fromCharCode(
        ...bytes.slice(offset, offset + length)
    );
}

export function readStsdFieldsFromRaw(raw) {
    const entryOffset = 16;
    const entrySize   = readUint32BE(raw, entryOffset);

    const compressorNameBytes =
        raw.slice(66, 66 + 32);

    const compressorNameLength =
        compressorNameBytes[0];

    const compressorName =
        readAscii(
            compressorNameBytes,
            1,
            compressorNameLength
        );

    return {
        stsd: {
            size: readUint32BE(raw, 0),
            version: raw[8],
            flags:
                (raw[9] << 16) |
                (raw[10] << 8) |
                raw[11],
            entryCount: readUint32BE(raw, 12),
        },

        sampleEntry: {
            size: entrySize,
            type: readAscii(raw, 20, 4),
            dataReferenceIndex: readUint16BE(raw, 30),
            width: readUint16BE(raw, 48),
            height: readUint16BE(raw, 50),
            horizResolution: readUint32BE(raw, 52),
            vertResolution:  readUint32BE(raw, 56),
            frameCount: readUint16BE(raw, 64),
            depth: readUint16BE(raw, 98),
            compressorName,
            compressorNameLength,
        },

        trailingBytes: raw.length - (entryOffset + entrySize)
    };
}


