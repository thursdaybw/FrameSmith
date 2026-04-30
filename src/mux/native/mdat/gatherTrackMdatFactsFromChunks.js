export function gatherTrackMdatFactsFromChunks({ accessUnitGroups, accessUnitPayloads }) {
    if (!Array.isArray(accessUnitGroups) || accessUnitGroups.length === 0) {
        throw new Error(
            "gatherTrackMdatFactsFromChunks: accessUnitGroups must be non-empty"
        );
    }

    const chunks = [];

    let trackCursor = 0;

    for (let chunkIndex = 0; chunkIndex < accessUnitGroups.length; chunkIndex++) {

        const group = accessUnitGroups[chunkIndex];

        if (!Array.isArray(group.samples) || group.samples.length === 0) {
            throw new Error(
                "gatherTrackMdatFactsFromChunks: group.samples must be non-empty"
            );
        }

        const chunkStart = trackCursor;
        let chunkByteLength = 0;

        const chunkBytes = [];

        for (const sample of group.samples) {
            const payload = accessUnitPayloads[sample.sampleIndex];

            if (!(payload instanceof Uint8Array)) {
                throw new Error(
                    `missing payload for sampleIndex ${sample.sampleIndex}`
                );
            }

            chunkBytes.push(payload);
            chunkByteLength += payload.length;
        }

        const bytes = new Uint8Array(chunkByteLength);

        let writeOffset = 0;
        for (const slice of chunkBytes) {
            bytes.set(slice, writeOffset);
            writeOffset += slice.length;
        }

        chunks.push({
            chunkIndex,
            byteOffsetInTrack: chunkStart,
            byteLength: chunkByteLength,
            bytes
        });

        trackCursor += chunkByteLength;
    }

    return { chunks };
}
