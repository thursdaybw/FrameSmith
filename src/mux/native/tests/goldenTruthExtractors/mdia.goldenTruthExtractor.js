import { asIsoBoxContainer } from "../../box-model/Box.js";
import { getGoldenTruthBox } from "./index.js";

/**
 * mdia — Media Box (Golden Truth Extractor)
 * ========================================
 *
 * Structural container for media-specific metadata.
 *
 * Rules:
 * - mdia has no fields of its own
 * - required children: mdhd, hdlr, minf
 * - no policy
 * - no inference
 * - no mutation
 *
 * readBoxReport defines STRUCTURAL TRUTH
 * getEmitterInput derives COMPILER INTENT from that truth
 */

// ---------------------------------------------------------------------------
// readBoxReport (structural truth)
// ---------------------------------------------------------------------------

function readBoxReport(boxBytes) {
    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error("mdia.readBoxReport: expected Uint8Array");
    }

    const container =
        asIsoBoxContainer(
            boxBytes,
            "moov/trak/mdia"
        );

    const children = container.enumerateChildren();

    const childrenMap = {};

    for (const child of children) {
        childrenMap[child.type] = { type: child.type };
    }

    return {
        raw: boxBytes,

        box: {
            type: "mdia",
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

    const mdhdInput = {
        boxBytes,
        sourceRegistryKey: "moov/trak/mdia",
        targetBoxPath: "moov/trak/mdia/mdhd"
    };

    const hdlrInput = {
        boxBytes,
        sourceRegistryKey: "moov/trak/mdia",
        targetBoxPath: "moov/trak/mdia/hdlr"
    };

    const minfInput = {
        boxBytes,
        sourceRegistryKey: "moov/trak/mdia",
        targetBoxPath: "moov/trak/mdia/minf"
    };

    return {
        mdhd: getGoldenTruthBox.getSemanticBoxDataFromBox(mdhdInput).getEmitterInput(),
        hdlr: getGoldenTruthBox.getSemanticBoxDataFromBox(hdlrInput).getEmitterInput(),
        minf: getGoldenTruthBox.getSemanticBoxDataFromBox(minfInput).getEmitterInput(),
    };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerMdiaGoldenTruthExtractor(register) {
    register.readBoxReport(readBoxReport);
    register.getEmitterInput(getEmitterInput);
}
