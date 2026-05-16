import { getGoldenTruthBox } from "./index.js";

/**
 * edts — Edit Box (Golden Truth Extractor)
 * ======================================
 *
 * Structural container for edit-related boxes.
 *
 * Rules:
 * - edts has no intrinsic fields
 * - structure is defined entirely by child boxes
 * - traversal is delegated to GoldenTruthPathResolver
 * - no ad-hoc container walking
 */
function readBoxReport(boxBytes) {
    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error("edts.readBoxReport: expected Uint8Array");
    }

    return {
        raw: boxBytes,

        box: {
            type: "edts",
            children: {
                elst: { type: "elst" }
            }
        },

        derived: {}
    };
}

/**
 * Compiler intent
 */
function getEmitterInput(boxBytes) {

    const elstInput = getGoldenTruthBox.getSemanticBoxDataFromBox({
        boxBytes,
        sourceRegistryKey: "moov/trak/edts",
        targetBoxPath: "moov/trak/edts/elst"
    }).getEmitterInput();

    return {
        elst: elstInput,
    };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------
export function registerEdtsGoldenTruthExtractor(register) {
    register.readBoxReport(readBoxReport);
    register.getEmitterInput(getEmitterInput);
}
