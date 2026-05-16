import { readUint32 } from "../../bytes/mp4ByteReader.js";
import { splitFixed1616 } from "../../bytes/mp4NumericFormats.js";
import { readBoxHeaderFromBytes } from "../../box-schema/boxLayoutReaders.js";
import { getPayloadOffsetForPath } from "../../box-schema/boxSchemas.js";

// ---------------------------------------------------------------------------
// readBoxReport (structural truth)
// ---------------------------------------------------------------------------
function readBoxReport(boxBytes) {
    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error("tkhd.readBoxReport: expected Uint8Array");
    }

    // ---------------------------------------------------------
    // Header (FullBox)
    // ---------------------------------------------------------
    const header = readBoxHeaderFromBytes(
        boxBytes,
        "moov/trak/tkhd"
    );

    // ---------------------------------------------------------
    // Payload
    // ---------------------------------------------------------
    let cursor = getPayloadOffsetForPath("moov/trak/tkhd");

    const creationTime     = readUint32(boxBytes, cursor); cursor += 4;
    const modificationTime = readUint32(boxBytes, cursor); cursor += 4;
    const trackId          = readUint32(boxBytes, cursor); cursor += 4;
    const reserved0        = readUint32(boxBytes, cursor); cursor += 4;
    const duration         = readUint32(boxBytes, cursor); cursor += 4;
    const reserved1        = readUint32(boxBytes, cursor); cursor += 4;
    const reserved2        = readUint32(boxBytes, cursor); cursor += 4;

    const layer           = (boxBytes[cursor] << 8) | boxBytes[cursor + 1]; cursor += 2;
    const alternateGroup  = (boxBytes[cursor] << 8) | boxBytes[cursor + 1]; cursor += 2;
    const volume          = (boxBytes[cursor] << 8) | boxBytes[cursor + 1]; cursor += 2;
    const reserved3       = (boxBytes[cursor] << 8) | boxBytes[cursor + 1]; cursor += 2;

    const matrix = [];
    for (let i = 0; i < 9; i++) {
        matrix.push(readUint32(boxBytes, cursor));
        cursor += 4;
    }

    const width  = readUint32(boxBytes, cursor); cursor += 4;
    const height = readUint32(boxBytes, cursor); cursor += 4;

    return {
        raw: boxBytes,

        box: {
            type: "tkhd",
            header,
            fields: {
                creationTime,
                modificationTime,
                trackId,
                reserved0,
                duration,
                reserved1,
                reserved2,
                layer,
                alternateGroup,
                volume,
                reserved3,

                matrix_a: matrix[0],
                matrix_b: matrix[1],
                matrix_u: matrix[2],
                matrix_c: matrix[3],
                matrix_d: matrix[4],
                matrix_v: matrix[5],
                matrix_x: matrix[6],
                matrix_y: matrix[7],
                matrix_w: matrix[8],

                width,
                height
            }
        },

        derived: {}
    };
}
// ---------------------------------------------------------------------------
// getEmitterInput (compiler intent)
// ---------------------------------------------------------------------------
function getEmitterInput(boxBytes) {

    const read = readBoxReport(boxBytes);
    const f = read.box.fields;

    const width  = splitFixed1616(f.width);
    const height = splitFixed1616(f.height);

    return {
        width:          width.integer,
        height:         height.integer,
        widthFraction:  width.fraction,
        heightFraction: height.fraction,
        duration:       f.duration,
        trackId:        f.trackId,
        alternateGroup: f.alternateGroup,
        volume:         f.volume
    };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerTkhdGoldenTruthExtractor(register) {
    register.readBoxReport(readBoxReport);
    register.getEmitterInput(getEmitterInput);
}
