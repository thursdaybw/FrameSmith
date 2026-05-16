import { readUint32 } from "../../bytes/mp4ByteReader.js";
import { readBoxHeaderFromBytes } from "../../box-schema/boxLayoutReaders.js";
import { getPayloadOffsetForPath } from "../../box-schema/boxSchemas.js";
import { readStructTableFromOffset } from "../../box-schema/boxLayoutReaders.js";

function readBoxReport(box) {
    if (!(box instanceof Uint8Array)) {
        throw new Error("stts.readBoxReport: expected Uint8Array");
    }

    const path = "moov/trak/mdia/minf/stbl/stts";

    const header = readBoxHeaderFromBytes(box, path);
    const payloadOffset = getPayloadOffsetForPath(path);

    const entryCount = readUint32(box, payloadOffset);

    const entries = readStructTableFromOffset({
        box,
        payloadOffset,
        count: entryCount,
        fieldNames: ["sampleCount", "sampleDelta"]
    });

    return {
        raw: box,
        box: {
            type: "stts",
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
            sampleCount: entry.sampleCount,
            sampleDelta: entry.sampleDelta
        }))
    };
}

export function registerSttsGoldenTruthExtractor(register) {
    register.readBoxReport(readBoxReport);
    register.getEmitterInput(getEmitterInput);
}
