import { asIsoBoxContainer } from "../../box-model/Box.js";
import { getGoldenTruthBox } from "./index.js";

// ---------------------------------------------------------------------------
// readBoxReport
// ---------------------------------------------------------------------------

function readUdtaFields(boxBytes) {

    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error("udta.readBoxReport: expected Uint8Array");
    }

    const container =
        asIsoBoxContainer(
            boxBytes,
            "moov/udta"
        );

    const children = container.enumerateChildren();

    const childrenMap = {};

    for (const child of children) {
        childrenMap[child.type] = { type: child.type };
    }

    return {
        raw: boxBytes,

        box: {
            type: "udta",
            fields: {},
            children: childrenMap
        },

        derived: {}
    };
}

// ---------------------------------------------------------------------------
// getEmitterInput
// ---------------------------------------------------------------------------
function getUdtaBuilderInput(boxBytes) {

    const report = readUdtaFields(boxBytes);
    const box    = report.box;

    const input = {
        children: []
    };

    for (const type of Object.keys(box.children)) {

        switch (type) {

            case "meta": {
                const metaParams =
                    getGoldenTruthBox
                        .getSemanticBoxDataFromBox({
                            boxBytes,
                            sourceRegistryKey: "moov/udta",
                            targetBoxPath: "moov/udta/meta"
                        })
                        .getEmitterInput();

                input.children.push({
                    type: "meta",
                    ...metaParams
                });
                break;
            }

            default:
                throw new Error(
                    `udta.getEmitterInput: unsupported child '${type}'`
                );
        }
    }

    return input;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerUdtaGoldenTruthExtractor(register) {
    register.readBoxReport(readUdtaFields);
    register.getEmitterInput(getUdtaBuilderInput);
}
