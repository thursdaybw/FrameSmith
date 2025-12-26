import { readFourCC } from "../../bytes/mp4ByteReader.js";

function readHdlrBoxFieldsFromBoxBytes(boxBytes) {
    return {
        handlerType: readFourCC(boxBytes, 16),
        nameBytes: boxBytes.slice(32),
        raw: boxBytes
    };
}

function getHdlrBuilderInputFromBoxBytes(boxBytes) {
    const fields = readHdlrBoxFieldsFromBoxBytes(boxBytes);

    return {
        handlerType: fields.handlerType,
        nameBytes: fields.nameBytes
    };
}

export function registerHdlrGoldenTruthExtractor(register) {
    register.readFields(readHdlrBoxFieldsFromBoxBytes);
    register.getBuilderInput(getHdlrBuilderInputFromBoxBytes);
}
