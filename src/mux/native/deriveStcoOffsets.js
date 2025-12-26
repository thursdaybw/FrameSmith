export function deriveStcoOffsets({
    chunks,
    mdatDataOffset
}) {
    let offset = mdatDataOffset;
    const offsets = [];

    for (const chunk of chunks) {
        offsets.push(offset);

        let chunkByteLength = 0;

        for (const sample of chunk.samples) {
            chunkByteLength += sample.bytes.length;
        }

        offset += chunkByteLength;
    }

    return offsets;
}
