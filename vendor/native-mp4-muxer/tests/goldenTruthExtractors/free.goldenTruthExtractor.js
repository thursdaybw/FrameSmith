import { readUint32 } from "../../bytes/mp4ByteReader.js";
import { readFourCC } from "../../box-schema/boxLayoutReaders.js";

/**
 * FREE — Free Space Box
 * ====================
 *
 * readBoxReport contract:
 * - raw      → exact bytes
 * - box      → schema-shaped structural facts
 * - derived  → none
 *
 * FREE has:
 * - no version / flags
 * - no defined fields
 * - optional payload (ignored structurally)
 */

// ---------------------------------------------------------------------------
// Structural read
// ---------------------------------------------------------------------------

function readFreeBoxReport(boxBytes) {
    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error("free.readBoxReport: expected Uint8Array");
    }

    // We do NOT parse payload.
    // FREE is structurally opaque and policy-ignored.

    return {
        raw: boxBytes,

        box: {
            type: "free",
            fields: {}
        },

        derived: {}
    };
}

// ---------------------------------------------------------------------------
// Builder input
// ---------------------------------------------------------------------------

function getFreeBuilderInputFromBoxReport(_readResult) {
    // FREE has no semantic or structural inputs
    return {};
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerFreeGoldenTruthExtractor(register) {
    register.readBoxReport(readFreeBoxReport);
    register.getEmitterInput(getFreeBuilderInputFromBoxReport);
}
