import { readUint32, readFourCC } from "../../bytes/mp4ByteReader.js";
import { getGoldenTruthBox } from "./index.js";

/**
 * STSD (mp4a) — Sample Description Box (Audio)
 * ===========================================
 *
 * Golden truth extractor for STSD containing exactly one mp4a entry.
 *
 * Responsibilities:
 * - assert STSD invariant
 * - assert single entry
 * - assert mp4a sample entry
 * - delegate mp4a parsing
 * - return emitter-ready params for emitStsdMp4aBox
 *
 * No branching.
 * No inference.
 * No codec dispatch.
 */

function readStsdMp4aFieldsFromBoxBytes(box) {
    if (!(box instanceof Uint8Array)) {
        throw new Error("stsdMp4a.readBoxReport: expected Uint8Array");
    }

    const entryCount = readUint32(box, 12);

    if (entryCount !== 1) {
        throw new Error(
            `stsdMp4a: expected exactly 1 entry, got ${entryCount}`
        );
    }

    const sampleEntryOffset = 16;
    const sampleEntryType = readFourCC(box, sampleEntryOffset + 4);

    if (sampleEntryType !== "mp4a") {
        throw new Error(
            `stsdMp4a: expected 'mp4a', found '${sampleEntryType}'`
        );
    }

    return {
        raw: box
    };
}

function getStsdMp4aBuildParamsFromBoxBytes(box) {
    const mp4a = getGoldenTruthBox.fromBox(
        box,
        "moov/trak[1]/mdia/minf/stbl/stsd/sample[0]"
    );
    return mp4a.getEmitterInput();
}

export function registerStsdMp4aGoldenTruthExtractor(register) {
    register.readBoxReport(readStsdMp4aFieldsFromBoxBytes);
    register.getEmitterInput(getStsdMp4aBuildParamsFromBoxBytes);
}
