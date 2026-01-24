import {
    readUint32,
    readUint16
} from "../../bytes/mp4ByteReader.js";

/**
 * MVHD Golden Truth Extractor
 * ==========================
 *
 * Test-only structural extractor for the Movie Header Box (mvhd).
 *
 * Contracts
 * ---------
 * readBoxReport():
 *   - returns raw bytes
 *   - returns box fields as structurally defined by ISO BMFF
 *   - returns no policy, preference, or mutation
 *
 * getEmitterInput():
 *   - returns only semantic intent required to rebuild mvhd
 *
 * No traversal.
 * No inference.
 * No normalization.
 */
function readMvhdFields(box) {
    if (!(box instanceof Uint8Array)) {
        throw new Error(
            "mvhd.readBoxReport: expected Uint8Array"
        );
    }

    let offset = 8;

    const version = box[offset];
    const flags =
        (box[offset + 1] << 16) |
        (box[offset + 2] << 8)  |
        box[offset + 3];

    offset += 4;

    const creationTime     = readUint32(box, offset); offset += 4;
    const modificationTime = readUint32(box, offset); offset += 4;
    const timescale        = readUint32(box, offset); offset += 4;
    const duration         = readUint32(box, offset); offset += 4;

    const rate   = readUint32(box, offset); offset += 4;
    const volume = readUint16(box, offset); offset += 2;

    const reservedShort = readUint16(box, offset); offset += 2;

    const reserved0 = readUint32(box, offset); offset += 4;
    const reserved1 = readUint32(box, offset); offset += 4;

    const matrix = [];
    for (let i = 0; i < 9; i++) {
        matrix.push(readUint32(box, offset));
        offset += 4;
    }

    const preDefined = [];
    for (let i = 0; i < 6; i++) {
        preDefined.push(readUint32(box, offset));
        offset += 4;
    }

    const nextTrackId = readUint32(box, offset);

    return {
        raw: box,

        box: {
            type: "mvhd",

            header: {
                version,
                flags
            },

            fields: {
                creationTime,
                modificationTime,
                timescale,
                duration,
                rate,
                volume,
                reservedShort,
                reserved0,
                reserved1,

                matrix0: matrix[0],
                matrix1: matrix[1],
                matrix2: matrix[2],
                matrix3: matrix[3],
                matrix4: matrix[4],
                matrix5: matrix[5],
                matrix6: matrix[6],
                matrix7: matrix[7],
                matrix8: matrix[8],

                preDefined0: preDefined[0],
                preDefined1: preDefined[1],
                preDefined2: preDefined[2],
                preDefined3: preDefined[3],
                preDefined4: preDefined[4],
                preDefined5: preDefined[5],

                nextTrackId
            }
        },

        derived: {}
    };
}

function getMvhdBuilderInput(boxBytes) {
    const read = readMvhdFields(boxBytes);

    return {
        timescale:   read.box.fields.timescale,
        duration:    read.box.fields.duration,
        nextTrackId: read.box.fields.nextTrackId
    };
}

export function registerMvhdGoldenTruthExtractor(register) {
    register.readBoxReport(readMvhdFields);
    register.getEmitterInput(getMvhdBuilderInput);
}
