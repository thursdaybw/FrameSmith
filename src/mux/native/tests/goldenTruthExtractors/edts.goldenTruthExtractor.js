import { extractChildBoxFromContainer } from "../reference/BoxExtractor.js";
import { getGoldenTruthBox } from "./index.js";

import { emitElstBox } from "../../box-emitters/elstBox.js";

function readEdtsBoxFieldsFromBoxBytes(box) {
    if (!(box instanceof Uint8Array)) {
        throw new Error("edts.readFields: expected Uint8Array");
    }

    return {
        raw: box
    };
}

function getEdtsEmitterInputFromBoxBytes(box) {

    function emitChild(name, emitter) {
        const childBytes = extractChildBoxFromContainer(box, name);
        if (!childBytes) {
            throw new Error(`EDTS missing required child '${name}'`);
        }

        const params = getGoldenTruthBox
            .fromBox(
                childBytes,
                `moov/trak/edts/${name}`
            )
            .getBuilderInput();

        return emitter(params);
    }

    return {
        elst: emitChild("elst", emitElstBox)
    };
}

export function registerEdtsGoldenTruthExtractor(register) {
    register.readFields(readEdtsBoxFieldsFromBoxBytes);
    register.getBuilderInput(getEdtsEmitterInputFromBoxBytes);
}
