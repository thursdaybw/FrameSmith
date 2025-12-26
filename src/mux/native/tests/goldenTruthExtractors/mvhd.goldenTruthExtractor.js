import { readUint32, readUint16 } from "../../bytes/mp4ByteReader.js";

/**
 * MVHD Parser
 * ===========
 *
 * Test-only parser for the Movie Header Box (mvhd).
 *
 * Exposes two capabilities:
 *   - readFields     → full structural truth
 *   - getBuilderInput → semantic intent for rebuilding
 *
 * No traversal.
 * No normalization.
 * No policy.
 */

function readMvhdBoxFieldsFromBoxBytes(box) {
    if (!(box instanceof Uint8Array)) {
        throw new Error(
            "mvhd.readFields: expected Uint8Array box bytes"
        );
    }

    const version = box[8];

    const flags =
        (box[9]  << 16) |
        (box[10] << 8)  |
        box[11];

    return {
        type: "mvhd",

        version,
        flags,

        timescale:   readUint32(box, 20),
        duration:    readUint32(box, 24),

        // fixed-point values preserved verbatim
        rate:        readUint32(box, 28),
        volume:      readUint16(box, 32),

        nextTrackId: readUint32(box, 104),

        raw: box
    };
}

function getMvhdBuildParamsFromBoxBytes(box) {
    const fields = readMvhdBoxFieldsFromBoxBytes(box);

    return {
        timescale:   fields.timescale,
        duration:    fields.duration,
        nextTrackId: fields.nextTrackId
    };
}

export function registerMvhdGoldenTruthExtractor(register) {
    register.readFields(readMvhdBoxFieldsFromBoxBytes);
    register.getBuilderInput(getMvhdBuildParamsFromBoxBytes);
}
