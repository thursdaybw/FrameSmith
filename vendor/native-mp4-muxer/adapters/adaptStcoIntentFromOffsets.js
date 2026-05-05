export function adaptStcoIntentFromOffsets({ chunkOffsets }) {
    if (!Array.isArray(chunkOffsets)) {
        throw new Error("adaptStcoIntentFromOffsets: chunkOffsets must be an array");
    }

    return {
        entryCount: chunkOffsets.length,
        chunkOffsets
    };
}
