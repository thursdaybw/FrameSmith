import { readUint16 } from "../../bytes/mp4ByteReader.js";

function readSmhdBoxFieldsFromBoxBytes(box) {
    if (!(box instanceof Uint8Array)) {
        throw new Error(
            "smhd.readBoxReport: expected Uint8Array"
        );
    }

    const version = box[8];
    const flags =
        (box[9] << 16) |
        (box[10] << 8) |
        box[11];

    const balance  = readUint16(box, 12);
    const reserved = readUint16(box, 14);

    return {
        raw: box,

        box: {
            type: "smhd",

            header: {
                version,
                flags
            },

            fields: {
                balance,
                reserved
            }
        },

        derived: {}
    };
}

function getSmhdBuildParamsFromBoxBytes(box) {
    const fields = readSmhdBoxFieldsFromBoxBytes(box);

    return {
        balance: fields.balance
    };
}

export function registerSmhdGoldenTruthExtractor(register) {
    register.readBoxReport(readSmhdBoxFieldsFromBoxBytes);
    register.getEmitterInput(getSmhdBuildParamsFromBoxBytes);
}
