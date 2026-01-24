import { readUint32 } from "../../bytes/mp4ByteReader.js";

/**
 * pasp — Pixel Aspect Ratio Box (Golden Truth Extractor)
 * =====================================================
 *
 * Structural, declarative extractor.
 * No inference. No normalization. No policy.
 */

function readPaspFields(boxBytes) {
    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error("pasp.readBoxReport: expected Uint8Array");
    }

    const hSpacing = readUint32(boxBytes, 8);
    const vSpacing = readUint32(boxBytes, 12);

    return {
        raw: boxBytes,
        box: {
            type: "pasp",
            fields: {
                hSpacing,
                vSpacing
            }
        },
        derived: {}
    };
}

function getPaspBuilderInput(boxBytes) {
    const fields = readPaspFields(boxBytes);

    return {
        hSpacing: fields.box.hSpacing,
        vSpacing: fields.box.vSpacing
    };
}

export function registerPaspGoldenTruthExtractor(register) {
    register.readBoxReport(readPaspFields);
    register.getEmitterInput(getPaspBuilderInput);
}
