import { readUint32 } from "../../bytes/mp4ByteReader.js";

/**
 * STSS — Sync Sample Box
 * ---------------------
 *
 * Declares which samples are random access points (keyframes).
 *
 * Semantics:
 * ----------
 * - Contains a table of 1-based sample numbers
 * - Absence of stss means "all samples are sync samples"
 *
 * IMPORTANT:
 * ----------
 * This parser does NOT infer that behavior.
 * If stss exists, it is treated as authoritative.
 *
 * No traversal.
 * No policy.
 * No normalization.
 */

function readStssBoxFieldsFromBoxBytes(box) {
    if (!(box instanceof Uint8Array)) {
        throw new Error(
            "stss.readFields: expected Uint8Array"
        );
    }

    const entryCount = readUint32(box, 12);

    const samples = [];
    let offset = 16;

    for (let i = 0; i < entryCount; i++) {
        samples.push(
            readUint32(box, offset)
        );
        offset += 4;
    }

    return {
        entryCount,
        samples,
        raw: box
    };
}

function getStssBuildParamsFromBoxBytes(box) {
    const parsed = readStssBoxFieldsFromBoxBytes(box);

    // Framesmith Phase A:
    // Preserve exactly what ffmpeg declared.
    // No inference, no expansion.
    return {
        sampleNumbers: parsed.samples.slice()
    };
}

export function registerStssGoldenTruthExtractor(register) {
    register.readFields(readStssBoxFieldsFromBoxBytes);
    register.getBuilderInput(getStssBuildParamsFromBoxBytes);
}
