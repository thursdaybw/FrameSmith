import { extractChildBoxFromContainer } from "../reference/BoxExtractor.js";
import { getGoldenTruthBox } from "./index.js";
import { emitDrefBox } from "../../box-emitters/drefBox.js";

function readDinfBoxFieldsFromBoxBytes(box) {
    if (!(box instanceof Uint8Array)) {
        throw new Error("dinf.readFields: expected Uint8Array");
    }

    const drefBytes = extractChildBoxFromContainer(box, "dref");

    if (!drefBytes) {
        throw new Error("dinf.readFields: missing required child 'dref'");
    }

    return {
        drefBytes,
        raw: box
    };
}

function getDinfBuildParamsFromBoxBytes(box) {
    const parsed = readDinfBoxFieldsFromBoxBytes(box);

    const drefParams = getGoldenTruthBox
        .fromBox(parsed.drefBytes, "moov/trak/mdia/minf/dinf/dref")
        .getBuilderInput();

    const drefNode = emitDrefBox(drefParams);

    return {
        dref: drefNode
    };
}

export function registerDinfGoldenTruthExtractor(register) {
    register.readFields(readDinfBoxFieldsFromBoxBytes);
    register.getBuilderInput(getDinfBuildParamsFromBoxBytes);
}
