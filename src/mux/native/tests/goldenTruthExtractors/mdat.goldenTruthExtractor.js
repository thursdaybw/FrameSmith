import { readUint32 } from "../../bytes/mp4ByteReader.js";
import { readFourCC } from "../../box-schema/boxLayoutReaders.js";
import { getOpaquePayloadFromBytes } from "../../box-schema/boxLayoutReaders.js";

/**
 * MDAT — Media Data Box
 * ====================
 *
 * Golden Truth contract:
 *
 * - raw      → exact bytes of the mdat box
 * - box      → schema-aligned structural facts only
 * - derived  → none
 *
 * Notes:
 * - mdat payload is opaque
 * - no fields
 * - no children
 * - payload is exposed ONLY via getEmitterInput
 */

// ---------------------------------------------------------------------------
// Structural read
// ---------------------------------------------------------------------------
function readMdatFieldsFromBoxBytes(boxBytes) {

    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error("mdat.readBoxReport: expected Uint8Array");
    }

    const type = readFourCC(boxBytes, 4);

    if (type !== "mdat") {
        throw new Error(
            `mdat.readBoxReport: expected 'mdat', got '${type}'`
        );
    }

    return {
        raw: boxBytes,

        box: {
            type: "mdat",
            fields: {}
        },

        derived: {}
    };
}

// ---------------------------------------------------------------------------
// Builder input
// ---------------------------------------------------------------------------
function getMdatBuilderInputFromBoxReport(boxBytes) {

    // ---------------------------------------------------------
    // Pin canonical bytes via readBoxReport
    // ---------------------------------------------------------
    const read = readMdatFieldsFromBoxBytes(boxBytes);
    const mdatRaw = read.raw;

    if (!(mdatRaw instanceof Uint8Array)) {
        throw new Error("mdat.getEmitterInput: expected Uint8Array");
    }

    return {
        payload: getOpaquePayloadFromBytes(
            mdatRaw,
            "mdat"
        )
    };
}
// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerMdatGoldenTruthExtractor(register) {
    register.readBoxReport(readMdatFieldsFromBoxBytes);
    register.getEmitterInput(getMdatBuilderInputFromBoxReport);
}
