import { readUint32 } from "../../bytes/mp4ByteReader.js";

function readFields(box) {
    const entryCount = readUint32(box, 12);
    const entries = [];
    let offset = 16;

    for (let i = 0; i < entryCount; i++) {
        entries.push({
            sampleCount: readUint32(box, offset),
            sampleDelta: readUint32(box, offset + 4)
        });
        offset += 8;
    }

    return {
        entryCount,
        entries,
        raw: box
    };
}

function getBuilderInput(box) {
    const parsed = readFields(box);

    if (parsed.entryCount !== 1) {
        throw new Error(
            `STTS: expected single entry, got ${parsed.entryCount}`
        );
    }

    return {
        sampleCount: parsed.entries[0].sampleCount,
        sampleDuration: parsed.entries[0].sampleDelta
    };
}

export function registerSttsGoldenTruthExtractor(register) {
    register.readFields(readFields);
    register.getBuilderInput(getBuilderInput);
}
