import { asIsoBoxContainer } from "../../box-model/Box.js";

const PATH = "moov/trak/mdia/minf/dinf";

// ---------------------------------------------------------------------------
// readBoxReport
// ---------------------------------------------------------------------------

function readDinfFields(boxBytes) {

    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error("dinf.readBoxReport: expected Uint8Array");
    }

    const container =
        asIsoBoxContainer(
            boxBytes,
            PATH
        );

    const children = container.enumerateChildren();

    if (children.length !== 1 || children[0].type !== "dref") {

        const receivedTypes =
            children.map(c => `'${c.type}'`).join(", ");

        throw new Error(
            "dinf.readBoxReport: expected exactly one 'dref' child, " +
            `but received ${children.length}: [${receivedTypes}]`
        );
    }

    return {
        raw: boxBytes,

        box: {
            type: "dinf",

            fields: {},

            children: {
                dref: {
                    type: "dref"
                }
            }
        },

        derived: {}
    };
}

// ---------------------------------------------------------------------------
// getEmitterInput
// ---------------------------------------------------------------------------

function getDinfBuilderInput() {
    return {};
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerDinfGoldenTruthExtractor(register) {
    register.readBoxReport(readDinfFields);
    register.getEmitterInput(getDinfBuilderInput);
}
