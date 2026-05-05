import {
    readUint32,
    readInt32,
    readUint64,
    readInt64,
    readUint16
} from "../../bytes/mp4ByteReader.js";

/**
 * elst — Edit List Box (Golden Truth Extractor)
 * ============================================
 *
 * Rules:
 * - structural read only
 * - no policy
 * - no inference
 * - no mutation
 *
 * readBoxReport returns:
 *   {
 *     raw,
 *     box,
 *     derived
 *   }
 */

function readElstFields(boxBytes) {
    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error("elst.readBoxReport: expected Uint8Array");
    }

    const version = boxBytes[8];
    const flags =
        (boxBytes[9]  << 16) |
        (boxBytes[10] << 8)  |
        boxBytes[11];

    const entryCount = readUint32(boxBytes, 12);

    let offset = 16;
    const entries = [];

    for (let i = 0; i < entryCount; i++) {

        let editDuration;
        let mediaTime;

        if (version === 1) {
            editDuration = readUint64(boxBytes, offset);
            offset += 8;

            mediaTime = readInt64(boxBytes, offset);
            offset += 8;
        } else {
            editDuration = readUint32(boxBytes, offset);
            offset += 4;

            mediaTime = readInt32(boxBytes, offset);
            offset += 4;
        }

        const mediaRateInteger  = readUint16(boxBytes, offset);
        offset += 2;

        const mediaRateFraction = readUint16(boxBytes, offset);
        offset += 2;

        entries.push({
            editDuration,
            mediaTime,
            mediaRateInteger,
            mediaRateFraction
        });
    }

    return {
        raw: boxBytes,

        box: {
            type: "elst",

            header: {
                version,
                flags
            },

            fields: {
                entryCount,
                entries
            },

        },

        derived: {}
    };

}

function getElstBuilderInput(boxBytes) {
    const read = readElstFields(boxBytes);

    const header = read.box.header;
    const fields = read.box.fields;

    return {
        version: header.version,
        flags: header.flags,
        entries: fields.entries.map(e => ({
            editDuration: e.editDuration,
            mediaTime: e.mediaTime,
            mediaRateInteger: e.mediaRateInteger,
            mediaRateFraction: e.mediaRateFraction
        }))
    };
}

export function registerElstGoldenTruthExtractor(register) {
    register.readBoxReport(readElstFields);
    register.getEmitterInput(getElstBuilderInput);
}
