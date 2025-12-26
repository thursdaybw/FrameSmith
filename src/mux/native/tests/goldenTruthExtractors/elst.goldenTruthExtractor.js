import {
    readUint32,
    readInt32,
    readUint64,
    readInt64,
    readUint16
} from "../../bytes/mp4ByteReader.js";

function readElstBoxFieldsFromBoxBytes(box) {
    if (!(box instanceof Uint8Array)) {
        throw new Error("elst.readFields: expected Uint8Array");
    }

    const version = box[8];
    const flags =
        (box[9]  << 16) |
        (box[10] << 8)  |
        box[11];

    const entryCount = readUint32(box, 12);

    return {
        version,
        flags,
        entryCount,
        raw: box
    };
}

function getElstEmitterInputFromBoxBytes(box) {
    const version = box[8];
    const flags =
        (box[9]  << 16) |
        (box[10] << 8)  |
        box[11];

    const entryCount = readUint32(box, 12);

    let offset = 16;
    const entries = [];

    for (let i = 0; i < entryCount; i++) {

        let editDuration;
        let mediaTime;

        if (version === 1) {
            editDuration = readUint64(box, offset);
            offset += 8;

            mediaTime = readInt64(box, offset);
            offset += 8;
        } else {
            editDuration = readUint32(box, offset);
            offset += 4;

            mediaTime = readInt32(box, offset);
            offset += 4;
        }

        const mediaRateInteger  = readUint16(box, offset);
        offset += 2;

        const mediaRateFraction = readUint16(box, offset);
        offset += 2;

        entries.push({
            editDuration,
            mediaTime,
            mediaRateInteger,
            mediaRateFraction
        });
    }

    return {
        version,
        flags,
        entries
    };
}

export function registerElstGoldenTruthExtractor(register) {
    register.readFields(readElstBoxFieldsFromBoxBytes);
    register.getBuilderInput(getElstEmitterInputFromBoxBytes);
}
