import { readUint32 } from "../../bytes/mp4ByteReader.js";

function readDataFieldsFromBoxBytes(box) {
    if (!(box instanceof Uint8Array)) {
        throw new Error("data.readFields: expected Uint8Array");
    }

    return {
        version: box[8],
        flags:
            (box[9]  << 16) |
            (box[10] << 8)  |
            box[11],

        dataType: readUint32(box, 12),
        locale:   readUint32(box, 16),

        payload: box.slice(20),

        raw: box
    };
}

function getDataEmitterInputFromBoxBytes(box) {
    const fields = readDataFieldsFromBoxBytes(box);

    return {
        version:  fields.version,
        flags:    fields.flags,
        dataType: fields.dataType,
        locale:   fields.locale,
        payload:  fields.payload
    };
}

export function registerDataGoldenTruthExtractor(register) {
    register.readFields(readDataFieldsFromBoxBytes);
    register.getBuilderInput(getDataEmitterInputFromBoxBytes);
}
