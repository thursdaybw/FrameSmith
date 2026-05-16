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

    let diagnosticsCache = undefined;

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

        derived: {},

        get diagnostics() {
            if (diagnosticsCache === undefined) {
                diagnosticsCache = decodeBtrtBox("BTRT", boxBytes);
            }
            return diagnosticsCache;
        }
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

function decodeBtrtBox(label = "BTRT", boxBytes) {

    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error("decodeBtrtBox: expected Uint8Array");
    }

    const size =
        (boxBytes[0] << 24) |
        (boxBytes[1] << 16) |
        (boxBytes[2] << 8)  |
        boxBytes[3];

    const type =
        String.fromCharCode(
            boxBytes[4],
            boxBytes[5],
            boxBytes[6],
            boxBytes[7]
        );

    if (type !== "btrt") {
        throw new Error(`decodeBtrtBox: expected 'btrt', got '${type}'`);
    }

    const payloadOffset = 8;

    if (size !== 20) {
        throw new Error(
            `decodeBtrtBox: expected size 20, got ${size}`
        );
    }

    const p = boxBytes;

    return [
        {
            label,
            bytes: "0–3",
            field: "bufferSizeDB",
            value:
            (p[payloadOffset + 0] << 24) |
            (p[payloadOffset + 1] << 16) |
            (p[payloadOffset + 2] << 8)  |
            p[payloadOffset + 3],
        },
        {
            label,
            bytes: "4–7",
            field: "maxBitrate",
            value:
            (p[payloadOffset + 4] << 24) |
            (p[payloadOffset + 5] << 16) |
            (p[payloadOffset + 6] << 8)  |
            p[payloadOffset + 7],
        },
        {
            label,
            bytes: "8–11",
            field: "avgBitrate",
            value:
            (p[payloadOffset + 8] << 24) |
            (p[payloadOffset + 9] << 16) |
            (p[payloadOffset + 10] << 8) |
            p[payloadOffset + 11],
        },
    ];
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerBtrtGoldenTruthExtractor(register) {
    register.readBoxReport(readBtrtFieldsFromBoxBytes);
    register.getEmitterInput(getBtrtBuilderInputFromBoxBytes);
}
