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

    /**
     * Builder input for STTS must reflect the true
     * run-length encoded structure of the table.
     *
     * Even constant-frame-rate video is represented
     * as a single-entry STTS table.
     *
     * Variable-duration video produces multiple entries.
     *
     * The emitter accepts this shape directly.
     */
    return {
        entries: parsed.entries.map(entry => ({
            sampleCount: entry.sampleCount,
            sampleDelta: entry.sampleDelta
        }))
    };
}

export function registerSttsGoldenTruthExtractor(register) {
    register.readFields(readFields);
    register.getBuilderInput(getBuilderInput);
}
