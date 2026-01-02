export function assembleMdatPayloadFromChunks({
    accessUnitGroups,
    accessUnitPayloads
}) {

    if (!Array.isArray(accessUnitGroups) || accessUnitGroups.length === 0) {
        throw new Error(
            "assembleMdatPayloadFromChunks: accessUnitGroups must be a non-empty array"
        );
    }

    if (!Array.isArray(accessUnitPayloads)) {
        throw new Error(
            "assembleMdatPayloadFromChunks: accessUnitPayloads must be an array"
        );
    }

    // Pass A: compute total payload size
    let totalByteLength = 0;

    for (const group of accessUnitGroups) {
        if (!Array.isArray(group.samples) || group.samples.length === 0) {
            throw new Error(
                "assembleMdatPayloadFromChunks: each group must contain non-empty samples[]"
            );
        }

        for (const sample of group.samples) {
            const payload = accessUnitPayloads[sample.sampleIndex];

            if (!(payload instanceof Uint8Array)) {
                throw new Error(
                    `assembleMdatPayloadFromChunks: missing payload for sampleIndex ${sample.sampleIndex}`
                );
            }

            totalByteLength += payload.length;
        }
    }

    const payload = new Uint8Array(totalByteLength);

    const chunkOffsets = [];
    const chunkByteLengths = [];

    let writeOffset = 0;

    for (const group of accessUnitGroups) {
        const groupStartOffset = writeOffset;
        let groupByteLength = 0;

        chunkOffsets.push(groupStartOffset);

        for (const sample of group.samples) {
            const bytes = accessUnitPayloads[sample.sampleIndex];

            payload.set(bytes, writeOffset);
            writeOffset += bytes.length;
            groupByteLength += bytes.length;
        }

        chunkByteLengths.push(groupByteLength);
    }

    if (writeOffset !== payload.length) {
        throw new Error(
            "assembleMdatPayloadFromChunks: internal byte length mismatch"
        );
    }

    return {
        payload,
        chunkOffsets,
        chunkByteLengths
    };
}
