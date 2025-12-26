import { extractChildBoxFromContainer } from "../reference/BoxExtractor.js";
import { getGoldenTruthBox } from "./index.js";

import { emitMdhdBox } from "../../box-emitters/mdhdBox.js";
import { emitHdlrBox } from "../../box-emitters/hdlrBox.js";
import { emitMinfBox } from "../../box-emitters/minfBox.js";

function readMdiaBoxFieldsFromBoxBytes(box) {
    if (!(box instanceof Uint8Array)) {
        throw new Error("mdia.readFields: expected Uint8Array");
    }

    return {
        raw: box
    };
}

function getMdiaBuildParamsFromBoxBytes(box) {

    function emitChild(name, emitter) {
        const childBytes = extractChildBoxFromContainer(box, name);

        const params = getGoldenTruthBox
            .fromBox(
                childBytes,
                `moov/trak/mdia/${name}`
            )
            .getBuilderInput();

        return emitter(params);
    }

    return {
        mdhd: emitChild("mdhd", emitMdhdBox),
        hdlr: emitChild("hdlr", emitHdlrBox),
        minf: emitChild("minf", emitMinfBox)
    };
}

export function registerMdiaGoldenTruthExtractor(register) {
    register.readFields(readMdiaBoxFieldsFromBoxBytes);
    register.getBuilderInput(getMdiaBuildParamsFromBoxBytes);
}
