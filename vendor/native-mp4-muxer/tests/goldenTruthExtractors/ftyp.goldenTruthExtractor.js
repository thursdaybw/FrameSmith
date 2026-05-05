import { readUint32 } from "../../bytes/mp4ByteReader.js";
import { readFourCC } from "../../box-schema/boxLayoutReaders.js";

/**
 * ftyp — File Type Box (Golden Truth Extractor)
 * ============================================
 *
 * Structural terminal extractor for the File Type Box.
 *
 * Rules:
 * - ftyp is a terminal box
 * - no children
 * - compatible_brands are FLAT, POSITIONAL fields
 * - no policy
 * - no inference
 * - no mutation
 */

// ---------------------------------------------------------------------------
// readBoxReport (structural truth)
// ---------------------------------------------------------------------------

function readBoxReport(boxBytes) {
    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error("ftyp.readBoxReport: expected Uint8Array");
    }

    if (readFourCC(boxBytes, 4) !== "ftyp") {
        throw new Error(
            "ftyp.readBoxReport: expected ftyp box bytes"
        );
    }

    const majorBrand   = readFourCC(boxBytes, 8);
    const minorVersion = readUint32(boxBytes, 12);

    const fields = {
        majorBrand,
        minorVersion
    };

    let index = 0;
    for (let offset = 16; offset < boxBytes.length; offset += 4) {
        fields[`compatibleBrand${index}`] =
            readFourCC(boxBytes, offset);
        index++;
    }

    return {
        raw: boxBytes,

        box: {
            type: "ftyp",
            fields
        },

        derived: {}
    };
}

// ---------------------------------------------------------------------------
// getEmitterInput (compiler intent)
// ---------------------------------------------------------------------------

function getEmitterInput(boxBytes) {

    const read = readBoxReport(boxBytes);
    const fields = read.box.fields;

    const compatibleBrands = [];
    let i = 0;

    while (`compatibleBrand${i}` in fields) {
        compatibleBrands.push(fields[`compatibleBrand${i}`]);
        i++;
    }

    return {
        majorBrand:    fields.majorBrand,
        minorVersion: fields.minorVersion,
        compatibleBrands
    };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerFtypGoldenTruthExtractor(register) {
    register.readBoxReport(readBoxReport);
    register.getEmitterInput(getEmitterInput);
}
