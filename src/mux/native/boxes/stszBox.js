import { writeUint32, writeString } from "../binary/Writer.js";

export function buildStszBox(sampleSizes) {

    if (!Array.isArray(sampleSizes)) {
        throw new Error("buildStszBox: sampleSizes must be an array");
    }

    const entryCount = sampleSizes.length;
    const boxSize = 20 + (entryCount * 4);

    const out = new Uint8Array(boxSize);

    // box size
    writeUint32(out, 0, boxSize);

    // box type
    writeString(out, 4, "stsz");

    // version + flags
    out[8] = 0;
    out[9] = 0;
    out[10] = 0;
    out[11] = 0;

    // sample_size == 0 means individual entries follow
    writeUint32(out, 12, 0);

    // sample_count
    writeUint32(out, 16, entryCount);

    // entries
    let offset = 20;
    for (let i = 0; i < entryCount; i++) {
        const sizeValue = sampleSizes[i];

        if (typeof sizeValue !== "number" || sizeValue < 0) {
            throw new Error("buildStszBox: all sample sizes must be non-negative numbers");
        }

        writeUint32(out, offset, sizeValue);
        offset += 4;
    }

    return out;
}
