import { readUint32 } from "../../bytes/mp4ByteReader.js";

/**
 * STCO — Chunk Offset Box
 * ----------------------
 *
 * Declares absolute byte offsets for each chunk.
 *
 * Parser responsibilities:
 * ------------------------
 * - Read entry_count
 * - Read absolute chunk offsets
 * - Preserve ordering and values exactly
 *
 * Non-responsibilities:
 * ---------------------
 * - No offset computation
 * - No chunking policy
 * - No inference
 * - No normalization
 */

function readStcoBoxFieldsFromBoxBytes(box) {
    if (!(box instanceof Uint8Array)) {
        throw new Error(
            "stco.readFields: expected Uint8Array"
        );
    }

    const version = box[8];

    if (version !== 0) {
        throw new Error(
            `STCO: unsupported version ${version} (expected 0)`
        );
    }

    const entryCount = readUint32(box, 12);

    const offsets = [];
    let offset = 16;

    for (let i = 0; i < entryCount; i++) {
        offsets.push(
            readUint32(box, offset)
        );
        offset += 4;
    }

    return {
        entryCount,
        offsets,
        raw: box
    };
}

function getStcoBuildParamsFromBoxBytes(box) {
    const parsed = readStcoBoxFieldsFromBoxBytes(box);

    // Framesmith Phase A:
    // Preserve exact offsets emitted by ffmpeg
    return {
        chunkOffsets: parsed.offsets.slice()
    };
}

export function registerStcoGoldenTruthExtractor(register) {
    register.readFields(readStcoBoxFieldsFromBoxBytes);
    register.getBuilderInput(getStcoBuildParamsFromBoxBytes);
}
