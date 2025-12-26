import { readUint32 } from "../../bytes/mp4ByteReader.js";

/**
 * STSZ — Sample Size Box
 * ---------------------
 *
 * Declares the byte size of each encoded sample.
 *
 * Parser responsibilities:
 * ------------------------
 * - Read variable-size sample table (sample_size == 0)
 * - Preserve declared sizes exactly
 * - Expose raw bytes for locked-layout equivalence
 *
 * Non-responsibilities:
 * ---------------------
 * - No inference
 * - No constant-size optimization
 * - No validation across boxes
 * - No mutation
 */

function readStszBoxFieldsFromBoxBytes(box) {
    if (!(box instanceof Uint8Array)) {
        throw new Error(
            "stsz.readFields: expected Uint8Array"
        );
    }

    const version = box[8];

    if (version !== 0) {
        throw new Error(
            `STSZ: unsupported version ${version} (expected 0)`
        );
    }

    const sampleSize  = readUint32(box, 12);
    const sampleCount = readUint32(box, 16);

    if (sampleSize !== 0) {
        throw new Error(
            `STSZ: constant sample_size ${sampleSize} not supported`
        );
    }

    const sizes = [];
    let offset = 20;

    for (let i = 0; i < sampleCount; i++) {
        sizes.push(
            readUint32(box, offset)
        );
        offset += 4;
    }

    return {
        sampleSize,
        sampleCount,
        sizes,
        raw: box
    };
}

function getStszBuildParamsFromBoxBytes(box) {
    const parsed = readStszBoxFieldsFromBoxBytes(box);

    // Framesmith Phase A:
    // Preserve exact sample sizes declared by ffmpeg
    return {
        sizes: parsed.sizes.slice()
    };
}

export function registerStszGoldenTruthExtractor(register) {
    register.readFields(readStszBoxFieldsFromBoxBytes);
    register.getBuilderInput(getStszBuildParamsFromBoxBytes);
}
