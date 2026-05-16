/**
 * avcC — AVC Configuration Box (Opaque)
 * ====================================
 *
 * Golden truth extractor for avcC.
 *
 * avcC is treated as an opaque payload at the MP4 container layer.
 * No semantic parsing is performed here.
 *
 * Structural truth:
 *   - this box exists
 *   - it contains a byte payload
 */


import {
  readFourCC,
  getOpaquePayloadFromBytes
} from "../../box-schema/boxLayoutReaders.js";

function readAvcCFieldsFromBoxBytes(boxBytes) {

    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error("avcC.readBoxReport: expected Uint8Array");
    }

    if (readFourCC(boxBytes, 4) !== "avcC") {
        throw new Error(
            "avcC.readBoxReport: expected 'avcC' box"
        );
    }

    const payload = getOpaquePayloadFromBytes(
        boxBytes,
        "moov/trak/mdia/minf/stbl/stsd|avc1/avcC"
    );

    return {
        raw: boxBytes,

        box: {
            type: "avcC",
            fields: {
                /**
                 * Expose the payload as a plain array of numbers.
                 *
                 * We intentionally do NOT return the Uint8Array here:
                 * - it would be a live view into the original buffer
                 * - it could be mutated by accident
                 * - it is awkward to inspect and compare in tests
                 *
                 * A plain array is a safe, snapshot representation of
                 * what was actually in the box at read time.
                 *
                 * The builder gets the real Uint8Array again later.
                 */
                opaquePayloadBytes: Array.from(payload)
            }
        },

        derived: {}
    };
}

function getAvcCBuilderInputFromBoxBytes(boxBytes) {
    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error(
            "avcC.getEmitterInput: expected Uint8Array"
        );
    }

    const read = readAvcCFieldsFromBoxBytes(boxBytes);

    return {
        avcC: getOpaquePayloadFromBytes(
            boxBytes,
            "moov/trak/mdia/minf/stbl/stsd|avc1/avcC"
        )
    };

}

export function registerAvcCGoldenTruthExtractor(register) {
    register.readBoxReport(readAvcCFieldsFromBoxBytes);
    register.getEmitterInput(getAvcCBuilderInputFromBoxBytes);
}
