import { extractChildBoxFromContainer } from "../reference/BoxExtractor.js";
import { getGoldenTruthBox } from "./index.js";

import { emitTkhdBox } from "../../box-emitters/tkhdBox.js";
import { emitEdtsBox } from "../../box-emitters/edtsBox.js";
import { emitMdiaBox } from "../../box-emitters/mdiaBox.js";

function readTrakBoxFieldsFromBoxBytes(box) {
    if (!(box instanceof Uint8Array)) {
        throw new Error("trak.readFields: expected Uint8Array");
    }

    return {
        raw: box
    };
}

function getTrakEmitterInputFromBoxBytes(box) {

    function emitChild(name, emitter) {
        const childBytes = extractChildBoxFromContainer(box, name);
        if (!childBytes) {
            throw new Error(`TRAK missing required child '${name}'`);
        }

        const params = getGoldenTruthBox
            .fromBox(
                childBytes,
                `moov/trak/${name}`
            )
            .getBuilderInput();

        return emitter(params);
    }

    const children = {
        tkhd: emitChild("tkhd", emitTkhdBox),
        mdia: emitChild("mdia", emitMdiaBox)
    };

    // edts is optional
    const edtsBytes = extractChildBoxFromContainer(box, "edts");
    if (edtsBytes) {
        children.edts = emitChild("edts", emitEdtsBox);
    }

    return children;
}

export function registerTrakGoldenTruthExtractor(register) {
    register.readFields(readTrakBoxFieldsFromBoxBytes);
    register.getBuilderInput(getTrakEmitterInputFromBoxBytes);
}
