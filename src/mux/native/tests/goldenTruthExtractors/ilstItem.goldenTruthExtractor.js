import { readFourCC } from "../../bytes/mp4ByteReader.js";
import { getGoldenTruthBox } from "./index.js";
import { emitDataBox } from "../../box-emitters/dataBox.js";
import { extractChildBoxFromIlstItem } from "../reference/BoxExtractor.js";

/**
 * readIlstItemBoxFieldsFromBoxBytes
 * --------------------------------
 * Answers:
 *   "What does this ilst item contain?"
 */
function readIlstItemBoxFieldsFromBoxBytes(boxBytes) {
    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error(
            "ilstItem.readFields: expected Uint8Array"
        );
    }

    return {
        type: readFourCC(boxBytes, 4),
        raw: boxBytes
    };
}

/**
 * getIlstItemEmitterInputFromBoxBytes
 * ----------------------------------
 * Answers:
 *   "What EXACT input object does emitIlstItemBox require
 *    to rebuild this ilst item?"
 *
 * emitIlstItemBox expects:
 *   {
 *     type: FourCC,
 *     data: <DATA BOX NODE>
 *   }
 *
 * Therefore this extractor MUST return a full data box node,
 * not data emitter params.
 */
function getIlstItemEmitterInputFromBoxBytes(boxBytes) {
    const type = readFourCC(boxBytes, 4);

    const dataBoxBytes = extractChildBoxFromIlstItem(
        boxBytes,
        "data"
    );

    const dataEmitterInput = getGoldenTruthBox
        .fromBox(
            dataBoxBytes,
            "moov/udta/meta/ilst/*/data"
        )
        .getBuilderInput();

    const dataNode = emitDataBox(dataEmitterInput);

    return {
        type,
        data: dataNode
    };
}

export function registerIlstItemGoldenTruthExtractor(register) {
    register.readFields(readIlstItemBoxFieldsFromBoxBytes);
    register.getBuilderInput(getIlstItemEmitterInputFromBoxBytes);
}
