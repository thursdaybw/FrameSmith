import { asIsoBoxContainer } from "../../box-model/Box.js";
import { getGoldenTruthBox } from "./index.js";
import { readUint32 } from "../../bytes/mp4ByteReader.js";
import { GoldenTruthRegistry } from "./GoldenTruthRegistry.js";
import { readFourCC } from "../..//box-schema/boxLayoutReaders.js";

// ---------------------------------------------------------------------------
// readBoxReport
// ---------------------------------------------------------------------------

function readIlstBoxReport(boxBytes) {

    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error("ilst.readBoxReport: expected Uint8Array");
    }

    const container =
        asIsoBoxContainer(
            boxBytes,
            "moov/udta/meta/ilst"
        );

    const children = container.enumerateChildren();

    const childrenMap = {};

    for (const child of children) {
        childrenMap[child.type] = { type: child.type };
    }

    return {
        raw: boxBytes,

        box: {
            type: "ilst",
            fields: {},
            children: childrenMap
        },

        derived: {}
    };
}

// ---------------------------------------------------------------------------
// getEmitterInput
// ---------------------------------------------------------------------------
function getIlstBuilderInput(boxBytes) {

    const report = readIlstBoxReport(boxBytes);

    const items = [];
    let offset = 8; // skip ilst header

    while (offset + 8 <= boxBytes.length) {
        const size = readUint32(boxBytes, offset);
        if (size < 8) break;

        const itemBytes = boxBytes.slice(offset, offset + size);

        const itemType = readFourCC(itemBytes, 4);

        const itemSemantic = getGoldenTruthBox.getSemanticBoxDataFromBox({
                boxBytes: boxBytes,
                sourceRegistryKey: "moov/udta/meta/ilst",
                targetBoxPath: `moov/udta/meta/ilst/${itemType}`
            });

        const itemInput =
            itemSemantic.getEmitterInput();
        items.push(itemInput);
        offset += size;
    }

    return { items };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerIlstGoldenTruthExtractor(register) {
    register.readBoxReport(readIlstBoxReport);
    register.getEmitterInput(getIlstBuilderInput);
}
