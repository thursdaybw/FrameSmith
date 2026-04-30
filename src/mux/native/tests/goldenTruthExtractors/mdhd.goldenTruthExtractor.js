/**
 * MDHD — Media Header Box (version 0)
 *
 * Contract:
 * ---------
 * - readBoxReport() exposes LOSSLESS on-disk structure
 * - No inference
 * - No normalization
 * - getEmitterInput derives ONLY from readBoxReport()
 */

import {
    readUint32,
    readUint16,
    readUint64
} from "../../bytes/mp4ByteReader.js";

import {
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
        throw new Error("mdhd.readBoxReport: expected Uint8Array");
    }

    const path = "moov/trak/mdia/mdhd";

    const header = readBoxHeaderFromBytes(box, path);
    const payloadOffset = getPayloadOffsetForPath(path);
    const version = Number(header?.version ?? 0);

    let creationTime;
    let modificationTime;
    let timescale;
    let duration;
    let language;
    let predefined;

    if (version === 1) {
        creationTime = readUint64(box, payloadOffset);
        modificationTime = readUint64(box, payloadOffset + 8);
        timescale = readUint32(box, payloadOffset + 16);
        duration = readUint64(box, payloadOffset + 20);
        language = readUint16(box, payloadOffset + 28);
        predefined = readUint16(box, payloadOffset + 30);
    } else {
        creationTime = readUint32(box, payloadOffset);
        modificationTime = readUint32(box, payloadOffset + 4);
        timescale = readUint32(box, payloadOffset + 8);
        duration = readUint32(box, payloadOffset + 12);
        language = readUint16(box, payloadOffset + 16);
        predefined = readUint16(box, payloadOffset + 18);
    }

    return {
        raw: box,

        box: {
            type: "mdhd",
            header,

            fields: {
                creationTime,
                modificationTime,
                timescale,
                duration,
                language,
                predefined
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
        timescale: read.box.fields.timescale,
        duration:  read.box.fields.duration
    };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerMdhdGoldenTruthExtractor(register) {
    register.readBoxReport(readBoxReport);
    register.getEmitterInput(getEmitterInput);
}
