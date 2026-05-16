import { readUint32, readFourCC } from "../../bytes/mp4ByteReader.js";
import { getGoldenTruthBox } from "./index.js";

/**
 * STSD (avc1) — Sample Description Box (Video)
 * ===========================================
 *
 * Golden truth extractor for STSD containing exactly one avc1 entry.
 *
 * Responsibilities:
 * - assert STSD invariant
 * - assert single entry
 * - assert avc1 sample entry
 * - delegate avc1 parsing
 * - return emitter-ready params for emitStsdAvc1Box
 *
 * No branching.
 * No inference.
 * No codec dispatch.
 */

function readStsdAvc1FieldsFromBoxBytes(box) {
    if (!(box instanceof Uint8Array)) {
        throw new Error("stsdAvc1.readBoxReport: expected Uint8Array");
    }

    const entryCount = readUint32(box, 12);

    if (entryCount !== 1) {
        throw new Error(
            `stsdAvc1: expected exactly 1 entry, got ${entryCount}`
        );
    }

    const sampleEntryOffset = 16;
    const sampleEntryType = readFourCC(box, sampleEntryOffset + 4);

    if (sampleEntryType !== "avc1") {
        throw new Error(
            `stsdAvc1: expected 'avc1', found '${sampleEntryType}'`
        );
    }

    return {
        entryCount,
        raw: box
    };

}

function getStsdAvc1BuildParamsFromBoxBytes(box) {

    const avc1 = getGoldenTruthBox.fromBox(
        box,
        "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]"
    );

    return avc1.getEmitterInput();
}

export function registerStsdAvc1GoldenTruthExtractor(register) {
    register.readBoxReport(readStsdAvc1FieldsFromBoxBytes);
    register.getEmitterInput(getStsdAvc1BuildParamsFromBoxBytes);
}
