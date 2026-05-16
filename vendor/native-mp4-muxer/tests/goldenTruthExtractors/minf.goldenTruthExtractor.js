import { asIsoBoxContainer } from "../../box-model/Box.js";
import { GoldenTruthRegistry } from "./GoldenTruthRegistry.js";

// ---------------------------------------------------------------------------
// readBoxReport (structural truth)
// ---------------------------------------------------------------------------

function readBoxReport(boxBytes) {

    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error("minf.readBoxReport: expected Uint8Array");
    }

    const path = "moov/trak/mdia/minf";

    const container =
        asIsoBoxContainer(boxBytes, path);

    const children = {};

    for (const { type, offset, size } of container.enumerateChildren()) {
        children[type] = {
            type,
            raw: boxBytes.slice(offset, offset + size)
        };
    }

    return {
        raw: boxBytes,

        box: {
            type: "minf",
            fields: {},
            children
        },

        derived: {}
    };
}

// ---------------------------------------------------------------------------
// getEmitterInput (compiler intent)
// ---------------------------------------------------------------------------

function getEmitterInput(boxBytes) {

    const read = readBoxReport(boxBytes);
    const children = read.box.children;

    const input = {};

    // ---------------------------------------------------------
    // Media header (EXACTLY ONE of vmhd or smhd)
    // ---------------------------------------------------------

    if (children.vmhd && children.smhd) {
        throw new Error(
            "minf.getEmitterInput: both vmhd and smhd present (illegal state)"
        );
    }

    if (!children.vmhd && !children.smhd) {
        throw new Error(
            "minf.getEmitterInput: missing media header (vmhd or smhd)"
        );
    }

    if (children.vmhd) {
        input.mediaHeader = { type: "vmhd" };
    }

    if (children.smhd) {
        input.mediaHeader = { type: "smhd" };
    }

    // ---------------------------------------------------------
    // Required child: dinf
    // ---------------------------------------------------------

    if (!children.dinf) {
        throw new Error("minf.getEmitterInput: missing required child 'dinf'");
    }

    const dinfExtractor =
        GoldenTruthRegistry.getExtractor(
            "moov/trak/mdia/minf/dinf"
        );

    if (!dinfExtractor) {
        throw new Error(
            "minf.getEmitterInput: no extractor registered for dinf"
        );
    }

    input.dinf =
        dinfExtractor.getEmitterInput(children.dinf.raw);

    // ---------------------------------------------------------
    // Required child: stbl
    // ---------------------------------------------------------

    if (!children.stbl) {
        throw new Error("minf.getEmitterInput: missing required child 'stbl'");
    }

    const stblExtractor =
        GoldenTruthRegistry.getExtractor(
            "moov/trak/mdia/minf/stbl"
        );

    if (!stblExtractor) {
        throw new Error(
            "minf.getEmitterInput: no extractor registered for stbl"
        );
    }

    input.stbl =
        stblExtractor.getEmitterInput(children.stbl.raw);

    return input;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerMinfGoldenTruthExtractor(register) {
    register.readBoxReport(readBoxReport);
    register.getEmitterInput(getEmitterInput);
}
