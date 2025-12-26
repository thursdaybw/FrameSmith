import { readUint32, readFourCC } from "../../bytes/mp4ByteReader.js";

function readFtypBoxFieldsFromBoxBytes(box) {
    const size = readUint32(box, 0);
    const type = readFourCC(box, 4);

    const majorBrand = readFourCC(box, 8);
    const minorVersion = readUint32(box, 12);

    const compatibleBrands = [];
    for (let offset = 16; offset + 4 <= size; offset += 4) {
        compatibleBrands.push(readFourCC(box, offset));
    }

    return {
        size,
        type,
        majorBrand,
        minorVersion,
        compatibleBrands,
        raw: box
    };
}

function getFtypBuildParamsFromBoxBytes(box) {
    const parsed = readFtypBoxFieldsFromBoxBytes(box);

    return {
        majorBrand: parsed.majorBrand,
        minorVersion: parsed.minorVersion,
        compatibleBrands: parsed.compatibleBrands.slice()
    };
}

export function registerFtypGoldenTruthExtractor(register) {
    register.readFields(readFtypBoxFieldsFromBoxBytes);
    register.getBuilderInput(getFtypBuildParamsFromBoxBytes);
}
