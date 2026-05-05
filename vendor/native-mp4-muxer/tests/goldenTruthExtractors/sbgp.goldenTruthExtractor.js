import { readUint32 } from "../../bytes/mp4ByteReader.js";
import { readBoxHeaderFromBytes } from "../../box-schema/boxLayoutReaders.js";
import {
    getPayloadOffsetForPath
} from "../../box-schema/boxSchemas.js";
import {
    readFourCC,
    readStructTableFromOffset
} from "../../box-schema/boxLayoutReaders.js";

function readBoxReport(boxBytes) {
    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error("sbgp.readBoxReport: expected Uint8Array");
    }

    const path = "moov/trak/mdia/minf/stbl/sbgp";
    const payloadOffset = getPayloadOffsetForPath(path);

    const header = readBoxHeaderFromBytes(boxBytes, path);

    const groupingType       = readUint32(boxBytes, payloadOffset);
    const groupingTypeString = readFourCC(boxBytes, payloadOffset);

    const entryCount   = readUint32(boxBytes, payloadOffset + 4);

    const entries = readStructTableFromOffset({
            box: boxBytes,
            payloadOffset: payloadOffset + 4,
            count: entryCount,
            fieldNames: ["sampleCount", "groupDescriptionIndex"]
        });

    return {
        raw: boxBytes,
        box: {
            type: "sbgp",
            header,
            fields: {
                groupingType,
                entryCount,
                entries
            }
        },
        derived: {
            groupingTypeString
        }
    };
}

export function registerSbgpGoldenTruthExtractor(register) {
    register.readBoxReport(readBoxReport);
    register.getEmitterInput(getEmitterInput);
}

function getEmitterInput(boxBytes) {
    const read = readBoxReport(boxBytes);

    return {
        groupingType: read.derived.groupingTypeString,
        entries: read.box.fields.entries
    };
}
