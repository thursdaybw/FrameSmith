/**
 * CO64 — Chunk Large Offset Box
 * =============================
 *
 * Same semantic role as STCO, but offsets are 64-bit.
 *
 * This builder is serialization-only:
 * - does NOT compute offsets
 * - does NOT inspect layout
 * - only encodes provided offsets
 */
function emitCo64Box({ chunkOffsets }) {
    if (!Array.isArray(chunkOffsets)) {
        throw new Error("emitCo64Box: chunkOffsets must be an array");
    }

    for (const offset of chunkOffsets) {
        if (typeof offset !== "number" || !Number.isFinite(offset) || offset < 0) {
            throw new Error("emitCo64Box: all offsets must be finite non-negative numbers");
        }
        if (!Number.isSafeInteger(offset)) {
            throw new Error("emitCo64Box: all offsets must be safe integers");
        }
    }

    const offsets = chunkOffsets.slice();

    return {
        type: "co64",
        version: 0,
        flags: 0,
        body: [
            { int: offsets.length },
            { array: "uint64", values: offsets }
        ]
    };
}

export function registerCo64Emitter(registry) {
    registry.registerEmitter(
        "moov/trak/mdia/minf/stbl/co64",
        emitCo64Box
    );
}
