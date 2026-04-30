import { readUint32, readUint64 } from "../../bytes/mp4ByteReader.js";
import {
    readBoxHeaderFromBytes
} from "../../box-schema/boxLayoutReaders.js";
import {
    getPayloadOffsetForPath
} from "../../box-schema/boxSchemas.js";

function readBoxReport(box) {
    if (!(box instanceof Uint8Array)) {
        throw new Error("co64.readBoxReport: expected Uint8Array");
    }
    if (box.length < 16) {
        throw new Error("co64.readBoxReport: box too small");
    }

    const path = "moov/trak/mdia/minf/stbl/co64";
    const header = readBoxHeaderFromBytes(box, path);
    const payloadOffset = getPayloadOffsetForPath(path);
    const entryCount = readUint32(box, payloadOffset);
    const chunkOffsets = new Array(entryCount);
    let offset = payloadOffset + 4;

    for (let i = 0; i < entryCount; i++) {
        if (offset + 8 > box.length) {
            throw new Error("co64.readBoxReport: chunk offset table truncated");
        }
        chunkOffsets[i] = readUint64(box, offset);
        offset += 8;
    }

    return {
        raw: box,
        box: {
            type: "co64",
            header,
            fields: {
                entryCount,
                chunkOffsets
            }
        },
        derived: {}
    };
}

function getEmitterInput(box) {
    const read = readBoxReport(box);
    return {
        chunkOffsets: read.box.fields.chunkOffsets.slice()
    };
}

export function registerCo64GoldenTruthExtractor(register) {
    register.readBoxReport(readBoxReport);
    register.getEmitterInput(getEmitterInput);
}
