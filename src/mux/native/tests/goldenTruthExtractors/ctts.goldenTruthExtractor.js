import { readUint32 } from "../../bytes/mp4ByteReader.js";

/**
 * CTTS — Composition Time to Sample Box
 * ------------------------------------
 *
 * Maps decoding time (DTS) to presentation time (PTS).
 *
 * Parser guarantees:
 * - version 0 only (unsigned offsets)
 * - no inference
 * - no compression
 * - no normalization
 *
 * This parser exists solely to extract the semantic parameters
 * required to rebuild an identical CTTS box.
 */

function readCttsBoxFieldsFromBoxBytes(box) {
    if (!(box instanceof Uint8Array)) {
        throw new Error(
            "ctts.readFields: expected Uint8Array"
        );
    }

    const version = box[8];

    if (version !== 0) {
        throw new Error(
            `ctts.readFields: unsupported version ${version} (expected 0)`
        );
    }

    const entryCount = readUint32(box, 12);

    const entries = [];
    let offset = 16;

    for (let i = 0; i < entryCount; i++) {
        entries.push({
            count:  readUint32(box, offset),
            offset: readUint32(box, offset + 4)
        });
        offset += 8;
    }

    return {
        version,
        entryCount,
        entries,
        raw: box
    };
}

function getCttsBuildParamsFromBoxBytes(box) {
    const parsed = readCttsBoxFieldsFromBoxBytes(box);

    // Phase A rule:
    // Preserve exactly what the file declares.
    return {
        entries: parsed.entries.map(e => ({
            count:  e.count,
            offset: e.offset
        }))
    };
}

/**
 * registerCttsParser
 * ------------------
 * Sole public export.
 */
export function registerCttsGoldenTruthExtractor(register) {
    register.readFields(readCttsBoxFieldsFromBoxBytes);
    register.getBuilderInput(getCttsBuildParamsFromBoxBytes);
}
