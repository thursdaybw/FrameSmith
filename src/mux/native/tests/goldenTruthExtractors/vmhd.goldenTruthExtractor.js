import { readUint16, readUint32 } from "../../bytes/mp4ByteReader.js";
import { readFourCC } from "../../box-schema/boxLayoutReaders.js";

/**
 * VMHD — Video Media Header Box
 * =============================
 *
 * readBoxReport contract:
 * - raw      → exact bytes
 * - box      → schema-shaped structural facts
 * - derived  → none
 */

// ---------------------------------------------------------------------------
// Structural read
// ---------------------------------------------------------------------------

function readVmhdFieldsFromBoxBytes(boxBytes) {
    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error("vmhd.readBoxReport: expected Uint8Array");
    }

    const size = readUint32(boxBytes, 0);
    const type = readFourCC(boxBytes, 4);

    if (type !== "vmhd") {
        throw new Error(
            `vmhd.readBoxReport: expected 'vmhd', got '${type}'`
        );
    }

    const version = boxBytes[8];
    const flags =
        (boxBytes[9]  << 16) |
        (boxBytes[10] << 8)  |
        boxBytes[11];

    const graphicsmode = readUint16(boxBytes, 12);

    const opcolorR = readUint16(boxBytes, 14);
    const opcolorG = readUint16(boxBytes, 16);
    const opcolorB = readUint16(boxBytes, 18);

    return {
        raw: boxBytes,

        box: {
            type: "vmhd",

            header: {
                version,
                flags
            },

            fields: {
                graphicsmode,
                opcolorR,
                opcolorG,
                opcolorB
            },

        },

        derived: {}
    };
}

// ---------------------------------------------------------------------------
// Builder input
// ---------------------------------------------------------------------------

function getVmhdBuilderInputFromBoxReport(readResult) {
    // vmhd has no configurable semantic input
    // structure is policy-owned
    return {};
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerVmhdGoldenTruthExtractor(register) {
    register.readBoxReport(readVmhdFieldsFromBoxBytes);
    register.getEmitterInput(getVmhdBuilderInputFromBoxReport);
}
