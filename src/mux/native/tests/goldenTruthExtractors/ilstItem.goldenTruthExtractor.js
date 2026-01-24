import { readFourCC } from "../../box-schema/boxLayoutReaders.js";
import { getGoldenTruthBox } from "./index.js";
import { extractChildBoxFromIlstItem } from "../reference/BoxExtractor.js";
import { GoldenTruthRegistry } from "./GoldenTruthRegistry.js";

/**
 * ilst item — Golden Truth Extractor
 * =================================
 *
 * Leaf box with dynamic FourCC type (e.g. "©too", "©nam").
 *
 * Rules:
 * - ilst item has no fixed schema beyond:
 *     - box type (dynamic FourCC)
 *     - one required child: data
 * - no policy
 * - no inference
 * - no mutation
 */

/**
 * readBoxReport
 * ----------
 * Structural + descriptive only.
 */
function readIlstItemFields(boxBytes) {
    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error("ilstItem.readBoxReport: expected Uint8Array");
    }

    const type = readFourCC(boxBytes, 4);

    const dataBoxBytes =
        extractChildBoxFromIlstItem(boxBytes, "data");

    if (!(dataBoxBytes instanceof Uint8Array)) {
        throw new Error(
            "ilstItem.readBoxReport: missing required child 'data'"
        );
    }

    return {
        raw: boxBytes,

        box: {
            type,
            children: {
                data: {
                    type: "data",
                    raw: dataBoxBytes
                }
            }
        },

        derived: {}
    };
}

function getIlstItemBuilderInput(boxBytes) {

    const read = readIlstItemFields(boxBytes);

    const { type, children } = read.box;

    const dataChild = children?.data;

    if (!dataChild || !(dataChild.raw instanceof Uint8Array)) {
        throw new Error(
            "ilstItem.getEmitterInput: missing required child 'data'"
        );
    }

    const extractor =
        GoldenTruthRegistry.getExtractor(
            `moov/udta/meta/ilst/${type}/data`
        );

    if (!extractor) {
        throw new Error(
            `ilstItem.getEmitterInput: no extractor registered for moov/udta/meta/ilst/${type}/data`
        );
    }

    const dataNode =
        extractor.getEmitterInput(dataChild.raw);

    return {
        type,
        data: dataNode
    };
}

export function registerIlstItemGoldenTruthExtractor(register) {
    register.readBoxReport(readIlstItemFields);
    register.getEmitterInput(getIlstItemBuilderInput);
}
