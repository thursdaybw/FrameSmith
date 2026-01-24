import { getGoldenTruthBox } from "./index.js";
import { asIsoBoxContainer } from "../../box-model/Box.js";
import { deriveSamplesFromStbl } from "./stbl/deriveSamplesFromStbl.js";

// ---------------------------------------------------------------------------
// readBoxReport
// ---------------------------------------------------------------------------

function readStblFields(boxBytes) {

    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error("stbl.readBoxReport: expected Uint8Array");
    }

    const container =
        asIsoBoxContainer(
            boxBytes,
            "moov/trak/mdia/minf/stbl"
        );

    const children = container.enumerateChildren();

    const childrenMap = {};

    for (const child of children) {
        childrenMap[child.type] = { type: child.type };
    }

    const samples =
        deriveSamplesFromStbl(boxBytes);

    return {
        raw: boxBytes,

        box: {
            type: "stbl",
            fields: {},
            children: childrenMap
        },

        derived: {
            samples
        }
    };
}

// ---------------------------------------------------------------------------
// getEmitterInput
// ---------------------------------------------------------------------------

function getStblBuilderInput(boxBytes) {

    const report = readStblFields(boxBytes);
    const box    = report.box;

    const input = {};

    // ---------------------------------------------------------
    // Required children
    // ---------------------------------------------------------

    if (!box.children.stsd) {
        throw new Error("stbl.getEmitterInput: missing required child 'stsd'");
    }

    if (!box.children.stts) {
        throw new Error("stbl.getEmitterInput: missing required child 'stts'");
    }

    if (!box.children.stsc) {
        throw new Error("stbl.getEmitterInput: missing required child 'stsc'");
    }

    if (!box.children.stsz) {
        throw new Error("stbl.getEmitterInput: missing required child 'stsz'");
    }

    if (!box.children.stco) {
        throw new Error("stbl.getEmitterInput: missing required child 'stco'");
    }

    input.stsd = getGoldenTruthBox.getSemanticBoxDataFromBox({
        boxBytes: boxBytes,
        sourceRegistryKey: "moov/trak/mdia/minf/stbl",
        targetBoxPath: "moov/trak/mdia/minf/stbl/stsd"
    }).getEmitterInput();

    input.stts = getGoldenTruthBox.getSemanticBoxDataFromBox({
        boxBytes: boxBytes,
        sourceRegistryKey: "moov/trak/mdia/minf/stbl",
        targetBoxPath: "moov/trak/mdia/minf/stbl/stts"
    }).getEmitterInput();

    input.stsc = getGoldenTruthBox.getSemanticBoxDataFromBox({
        boxBytes: boxBytes,
        sourceRegistryKey: "moov/trak/mdia/minf/stbl",
        targetBoxPath: "moov/trak/mdia/minf/stbl/stsc"
    }).getEmitterInput();

    input.stsz = getGoldenTruthBox.getSemanticBoxDataFromBox({
        boxBytes: boxBytes,
        sourceRegistryKey: "moov/trak/mdia/minf/stbl",
        targetBoxPath: "moov/trak/mdia/minf/stbl/stsz"
    }).getEmitterInput();

    input.stco = getGoldenTruthBox.getSemanticBoxDataFromBox({
        boxBytes: boxBytes,
        sourceRegistryKey: "moov/trak/mdia/minf/stbl",
        targetBoxPath: "moov/trak/mdia/minf/stbl/stco"
    }).getEmitterInput();

    // ---------------------------------------------------------
    // Optional children
    // ---------------------------------------------------------

    if (box.children.ctts) {
        input.ctts = getGoldenTruthBox.getSemanticBoxDataFromBox({
            boxBytes: boxBytes,
            sourceRegistryKey: "moov/trak/mdia/minf/stbl",
            targetBoxPath: "moov/trak/mdia/minf/stbl/ctts"
        }).getEmitterInput();
    }

    if (box.children.stss) {
        input.stss = getGoldenTruthBox.getSemanticBoxDataFromBox({
            boxBytes: boxBytes,
            sourceRegistryKey: "moov/trak/mdia/minf/stbl",
            targetBoxPath: "moov/trak/mdia/minf/stbl/stss"
        }).getEmitterInput();
    }

    if (box.children.sgpd) {
        input.sgpd = getGoldenTruthBox.getSemanticBoxDataFromBox({
            boxBytes: boxBytes,
            sourceRegistryKey: "moov/trak/mdia/minf/stbl",
            targetBoxPath: "moov/trak/mdia/minf/stbl/sgpd"
        }).getEmitterInput();
    }

    if (box.children.sbgp) {
        input.sbgp = getGoldenTruthBox.getSemanticBoxDataFromBox({
            boxBytes: boxBytes,
            sourceRegistryKey: "moov/trak/mdia/minf/stbl",
            targetBoxPath: "moov/trak/mdia/minf/stbl/sbgp"
        }).getEmitterInput();
    }

    return input;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerStblGoldenTruthExtractor(register) {
    register.readBoxReport(readStblFields);
    register.getEmitterInput(getStblBuilderInput);
}
