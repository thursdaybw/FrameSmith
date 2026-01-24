import { readUint32 } from "../../bytes/mp4ByteReader.js";

/**
 * BTRT — Bitrate Box
 * ==================
 *
 * Layout (ISO/IEC 14496-12):
 *
 *   uint32 bufferSizeDB
 *   uint32 maxBitrate
 *   uint32 avgBitrate
 *
 * Contract:
 * ---------
 * - readBoxReport() exposes LOSSLESS on-disk structure
 * - No inference
 * - No semantic interpretation
 */

// ---------------------------------------------------------------------------
// readBoxReport (structural truth)
// ---------------------------------------------------------------------------

function readBtrtFieldsFromBoxBytes(boxBytes) {
    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error("btrt.readBoxReport: expected Uint8Array");
    }

    return {
        raw: boxBytes,

        box: {
            type: "btrt",
            fields: {
                bufferSizeDB: readUint32(boxBytes, 8),
                maxBitrate:   readUint32(boxBytes, 12),
                avgBitrate:   readUint32(boxBytes, 16)
            }
        },

        derived: {}
    };
}

// ---------------------------------------------------------------------------
// getEmitterInput (builder intent)
// ---------------------------------------------------------------------------

function getBtrtBuilderInputFromBoxBytes(boxBytes) {
    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error("btrt.getEmitterInput: expected Uint8Array");
    }

    return {
        bufferSizeDB: readUint32(boxBytes, 8),
        maxBitrate:   readUint32(boxBytes, 12),
        avgBitrate:   readUint32(boxBytes, 16)
    };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerBtrtGoldenTruthExtractor(register) {
    register.readBoxReport(readBtrtFieldsFromBoxBytes);
    register.getEmitterInput(getBtrtBuilderInputFromBoxBytes);
}
