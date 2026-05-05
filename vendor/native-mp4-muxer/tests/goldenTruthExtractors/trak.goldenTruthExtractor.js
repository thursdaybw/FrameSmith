import { asIsoBoxContainer } from "../../box-model/Box.js";
import { getGoldenTruthBox } from "./index.js";

/**
 * trak — Track Box (Golden Truth Extractor)
 * ========================================
 *
 * Structural container for a single track.
 *
 * Rules:
 * - trak has no fields of its own
 * - required children: tkhd, mdia
 * - optional child: edts
 * - no policy
 * - no inference
 * - no mutation
 */

// ---------------------------------------------------------------------------
// readBoxReport (structural truth)
// ---------------------------------------------------------------------------

function readBoxReport(boxBytes) {
    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error("trak.readBoxReport: expected Uint8Array");
    }

    const container =
        asIsoBoxContainer(
            boxBytes,
            "moov/trak"
        );

    const children = container.enumerateChildren();
    const childrenMap = {};

    for (const child of children) {
        childrenMap[child.type] = { type: child.type };
    }

    return {
        raw: boxBytes,

        box: {
            type: "trak",
            children: childrenMap
        },

        derived: {}
    };
}

// ---------------------------------------------------------------------------
// getEmitterInput (compiler intent)
// ---------------------------------------------------------------------------
function getEmitterInput(boxBytes) {

    const read = readBoxReport(boxBytes);
    const raw  = read.raw;

    const input = {
        tkhd:
            getGoldenTruthBox
                .getSemanticBoxDataFromBox({
                    boxBytes: raw,
                    sourceRegistryKey: "moov/trak",
                    targetBoxPath: "moov/trak/tkhd"
                })
                .getEmitterInput(),

        mdia:
            getGoldenTruthBox
                .getSemanticBoxDataFromBox({
                    boxBytes: raw,
                    sourceRegistryKey: "moov/trak",
                    targetBoxPath: "moov/trak/mdia"
                })
                .getEmitterInput()
    };

    // Optional child: edts
    if (read.box.children.edts) {
        input.edts =
            getGoldenTruthBox
                .getSemanticBoxDataFromBox({
                    boxBytes: raw,
                    sourceRegistryKey: "moov/trak",
                    targetBoxPath: "moov/trak/edts"
                })
                .getEmitterInput();
    }

    return input;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerTrakGoldenTruthExtractor(register) {
    register.readBoxReport(readBoxReport);
    register.getEmitterInput(getEmitterInput);
}
