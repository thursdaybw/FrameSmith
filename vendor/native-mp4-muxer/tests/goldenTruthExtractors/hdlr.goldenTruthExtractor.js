/**
 * HDLR — Handler Reference Box
 *
 * Contract:
 * ---------
 * - readBoxReport() exposes LOSSLESS on-disk structure
 * - No inference
 * - No normalization
 * - getEmitterInput derives ONLY from readBoxReport()
 */

import {
    readUint32
} from "../../bytes/mp4ByteReader.js";

import {
    readFourCC,
    readBoxHeaderFromBytes
} from "../../box-schema/boxLayoutReaders.js";

import {
    getPayloadOffsetForPath
} from "../../box-schema/boxSchemas.js";

// ---------------------------------------------------------------------------
// readBoxReport (structural truth)
// ---------------------------------------------------------------------------

function readBoxReport(box) {
    if (!(box instanceof Uint8Array)) {
        throw new Error("hdlr.readBoxReport: expected Uint8Array");
    }

    const path = "moov/trak/mdia/hdlr";

    const header = readBoxHeaderFromBytes(box, path);
    const payloadOffset = getPayloadOffsetForPath(path);

    return {
        raw: box,

        box: {
            type: "hdlr",
            header,

            fields: {
                preDefined:  readUint32(box, payloadOffset),
                handlerType: readFourCC(box, payloadOffset + 4),
                reserved1:   readUint32(box, payloadOffset + 8),
                reserved2:   readUint32(box, payloadOffset + 12),
                reserved3:   readUint32(box, payloadOffset + 16),

                // STRUCTURAL truth = array
                nameBytes: Array.from(
                    box.slice(payloadOffset + 20)
                )
            }
        },

        derived: {}
    };
}

// ---------------------------------------------------------------------------
// getEmitterInput (compiler intent)
// ---------------------------------------------------------------------------

function getEmitterInput(box) {
    const read = readBoxReport(box);

    return {
        handlerType: read.box.fields.handlerType,

        // COMPILER intent = Uint8Array
        nameBytes: new Uint8Array(
            read.box.fields.nameBytes
        )
    };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerHdlrGoldenTruthExtractor(register) {
    register.readBoxReport(readBoxReport);
    register.getEmitterInput(getEmitterInput);
}
