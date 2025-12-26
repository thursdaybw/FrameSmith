function readBtrtBoxFieldsFromBoxBytes(boxBytes) {
    return {
        raw: boxBytes
    };
}

function getBtrtBuilderInputFromBoxBytes(boxBytes) {
    return {
        bufferSizeDB: (boxBytes[8]  << 24) |
                      (boxBytes[9]  << 16) |
                      (boxBytes[10] << 8)  |
                      boxBytes[11],

        maxBitrate:   (boxBytes[12] << 24) |
                      (boxBytes[13] << 16) |
                      (boxBytes[14] << 8)  |
                      boxBytes[15],

        avgBitrate:   (boxBytes[16] << 24) |
                      (boxBytes[17] << 16) |
                      (boxBytes[18] << 8)  |
                      boxBytes[19]
    };
}

export function registerBtrtGoldenTruthExtractor(register) {
    register.readFields(readBtrtBoxFieldsFromBoxBytes);
    register.getBuilderInput(getBtrtBuilderInputFromBoxBytes);
}
