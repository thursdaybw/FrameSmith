import { readUint32 } from "../../bytes/mp4ByteReader.js";

function readStscBoxFieldsFromBoxBytes(box) {
    const entryCount = readUint32(box, 12);

    const entries = [];
    let offset = 16;

    for (let i = 0; i < entryCount; i++) {
        entries.push({
            firstChunk: readUint32(box, offset),
            samplesPerChunk: readUint32(box, offset + 4),
            sampleDescriptionIndex: readUint32(box, offset + 8)
        });
        offset += 12;
    }

    return {
        entryCount,
        entries,
        raw: box
    };
}

function getStscBuildParamsFromBoxBytes(box) {
    const parsed = readStscBoxFieldsFromBoxBytes(box);

    if (parsed.entryCount !== 1) {
        throw new Error(
            `STSC: expected single entry, got ${parsed.entryCount}`
        );
    }

    const entry = parsed.entries[0];

    return {
        firstChunk: entry.firstChunk,
        samplesPerChunk: entry.samplesPerChunk,
        sampleDescriptionIndex: entry.sampleDescriptionIndex
    };
}

export function registerStscGoldenTruthExtractor(register) {
    register.readFields(readStscBoxFieldsFromBoxBytes);
    register.getBuilderInput(getStscBuildParamsFromBoxBytes);
}
