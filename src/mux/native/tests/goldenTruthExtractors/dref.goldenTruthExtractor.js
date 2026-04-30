import { asIsoBoxContainer } from "../../box-model/Box.js";

// ---------------------------------------------------------------------------
// readBoxReport
// ---------------------------------------------------------------------------

function readDrefFields(boxBytes) {

    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error("dref.readBoxReport: expected Uint8Array");
    }

    const PATH = "moov/trak/mdia/minf/dinf/dref";

    // ---------------------------------------------------------
    // Treat dref itself as the container
    // ---------------------------------------------------------
    const container =
        asIsoBoxContainer(
            boxBytes,
            PATH
        );

    const children =
        container.enumerateChildren();

    if (children.length !== 1 || children[0].type !== "url ") {

        const receivedTypes =
            children.map(c => `'${c.type}'`).join(", ");

        throw new Error(
            "dref.readBoxReport: expected exactly one 'url ' child, " +
            `but received ${children.length}: [${receivedTypes}]`
        );
    }

    const url = children[0];

    return {
        raw: boxBytes,

        box: {
            type: "dref",

            // dref is a Full box; header is schema-owned
            header: {
                version: 0,
                flags:   0
            },

            fields: {
                entryCount: 1
            },

            children: {
                "url ": {
                    type: "url ",

                    header: {
                        version: 0,
                        flags:   1
                    },

                    fields: {},

                    children: {}
                }
            }
        },

        derived: {}
    };
}

// ---------------------------------------------------------------------------
// getEmitterInput
// ---------------------------------------------------------------------------

function getDrefBuilderInput() {
    return {};
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerDrefGoldenTruthExtractor(register) {
    register.readBoxReport(readDrefFields);
    register.getEmitterInput(getDrefBuilderInput);
}
