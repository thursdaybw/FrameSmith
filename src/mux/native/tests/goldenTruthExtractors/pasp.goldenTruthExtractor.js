function readPaspBoxFieldsFromBoxBytes(boxBytes) {
    return {
        hSpacing:
            (boxBytes[8]  << 24) |
            (boxBytes[9]  << 16) |
            (boxBytes[10] << 8)  |
            boxBytes[11],

        vSpacing:
            (boxBytes[12] << 24) |
            (boxBytes[13] << 16) |
            (boxBytes[14] << 8)  |
            boxBytes[15],

        raw: boxBytes
    };
}

function getPaspBuilderInputFromBoxBytes(boxBytes) {
    const fields = readPaspBoxFieldsFromBoxBytes(boxBytes);

    return {
        hSpacing: fields.hSpacing,
        vSpacing: fields.vSpacing
    };
}

export function registerPaspGoldenTruthExtractor(register) {
    register.readFields(readPaspBoxFieldsFromBoxBytes);
    register.getBuilderInput(getPaspBuilderInputFromBoxBytes);
}
