import { asIsoBoxContainer } from "../../box-model/Box.js";
import { getGoldenTruthBox } from "./index.js";

// ---------------------------------------------------------------------------
// readBoxReport
// ---------------------------------------------------------------------------

function readMetaFields(boxBytes) {

    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error("meta.readBoxReport: expected Uint8Array");
    }

    const container =
        asIsoBoxContainer(
            boxBytes,
            "moov/udta/meta"
        );

    const children = container.enumerateChildren();

    const childrenMap = {};

    for (const child of children) {
        childrenMap[child.type] = { type: child.type };
    }

    return {
        raw: boxBytes,

        box: {
            type: "meta",

            header: {
                version: boxBytes[8],
                flags:
                    (boxBytes[9] << 16) |
                    (boxBytes[10] << 8) |
                    boxBytes[11],
            },

            fields: {},
            children: childrenMap
        },

        derived: {}
    };
}

// ---------------------------------------------------------------------------
// getEmitterInput
// ---------------------------------------------------------------------------

function getMetaBuilderInput(boxBytes) {

    const report = readMetaFields(boxBytes);
    const box    = report.box;

    const input = {};

    // ---------------------------------------------------------
    // Required children
    // ---------------------------------------------------------

    if (!box.children.hdlr) {
        throw new Error("meta.getEmitterInput: missing required child 'hdlr'");
    }

    if (!box.children.ilst) {
        throw new Error("meta.getEmitterInput: missing required child 'ilst'");
    }

    input.hdlr =
        getGoldenTruthBox.getSemanticBoxDataFromBox({
            boxBytes: boxBytes,
            sourceRegistryKey: "moov/udta/meta",
            targetBoxPath: "moov/udta/meta/hdlr"
        }).getEmitterInput();

    input.ilst =
        getGoldenTruthBox.getSemanticBoxDataFromBox({
            boxBytes: boxBytes,
            sourceRegistryKey: "moov/udta/meta",
            targetBoxPath: "moov/udta/meta/ilst"
        }).getEmitterInput();

    return input;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerMetaGoldenTruthExtractor(register) {
    register.readBoxReport(readMetaFields);
    register.getEmitterInput(getMetaBuilderInput);
}
