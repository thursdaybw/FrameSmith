import { readUint32 } from "../../bytes/mp4ByteReader.js";
import { readBoxHeaderFromBytes } from "../../box-schema/boxLayoutReaders.js";
import { getPayloadOffsetForPath } from "../../box-schema/boxSchemas.js";
import { readStructTableFromOffset } from "../../box-schema/boxLayoutReaders.js";

function readBoxReport(box) {
    if (!(box instanceof Uint8Array)) {
        throw new Error("stsc.readBoxReport: expected Uint8Array");
    }

    const path = "moov/trak/mdia/minf/stbl/stsc";

    const header = readBoxHeaderFromBytes(box, path);
    const payloadOffset = getPayloadOffsetForPath(path);

    const entryCount = readUint32(box, payloadOffset);

    const entries = readStructTableFromOffset({
        box,
        payloadOffset,
        count: entryCount,
        fieldNames: [
            "firstChunk",
            "samplesPerChunk",
            "sampleDescriptionIndex"
        ]
    });

    return {
        raw: box,
        box: {
            type: "stsc",
            header,
            fields: {
                entryCount,
                entries
            }
        },
        derived: {}
    };
}

function getEmitterInput(box) {
    const parsed = readBoxReport(box);

    return {
        entries: parsed.box.fields.entries.map(entry => ({
            firstChunk: entry.firstChunk,
            samplesPerChunk: entry.samplesPerChunk,
            sampleDescriptionIndex: entry.sampleDescriptionIndex
        }))
    };
}

export function registerStscGoldenTruthExtractor(register) {
    register.readBoxReport(readBoxReport);
    register.getEmitterInput(getEmitterInput);
}
