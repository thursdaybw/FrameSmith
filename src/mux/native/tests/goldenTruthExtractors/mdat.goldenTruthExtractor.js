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

    let diagnosticsCache = undefined;

    return {
        raw: boxBytes,

        box: {
            type: "mdat",
            fields: {}
        },

        derived: {},
        
        get diagnostics() {
            if (diagnosticsCache === undefined) {
                diagnosticsCache = decodeMdatPayload("MDAT", boxBytes);
            }
            return diagnosticsCache;
        }
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

export function decodeMdatPayload(label, boxBytes) {

    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error("decodeMdatPayload: expected Uint8Array");
    }

    if (boxBytes.length < 8) {
        throw new Error(
            "decodeMdatPayload: boxBytes too small for mdat box"
        );
    }

    const size =
        (boxBytes[0] << 24) |
        (boxBytes[1] << 16) |
        (boxBytes[2] << 8)  |
        boxBytes[3];

    const payloadOffset = 8;
    const payloadLength = size - payloadOffset;

    if (payloadLength < 0) {
        throw new Error(
            "decodeMdatPayload: invalid mdat size"
        );
    }

    return [
        {
            label,
            bytes: `8–${size - 1}`,
            field: "mdatPayloadBytes",
            value: {
                offset: payloadOffset,
                length: payloadLength
            }
        }
    ];
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerMdatGoldenTruthExtractor(register) {
    register.readBoxReport(readMdatFieldsFromBoxBytes);
    register.getEmitterInput(getMdatBuilderInputFromBoxReport);
}
