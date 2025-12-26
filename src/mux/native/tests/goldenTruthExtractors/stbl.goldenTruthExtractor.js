import { extractChildBoxFromContainer } from "../reference/BoxExtractor.js";
import { getGoldenTruthBox } from "./index.js";

import { emitStsdBox } from "../../box-emitters/stsdBox.js";
import { emitSttsBox } from "../../box-emitters/sttsBox.js";
import { emitStssBox } from "../../box-emitters/stssBox.js";
import { emitCttsBox } from "../../box-emitters/cttsBox.js";
import { emitStscBox } from "../../box-emitters/stscBox.js";
import { emitStszBox } from "../../box-emitters/stszBox.js";
import { emitStcoBox } from "../../box-emitters/stcoBox.js";

function readStblBoxFieldsFromBoxBytes(box) {
    if (!(box instanceof Uint8Array)) {
        throw new Error("stbl.readFields: expected Uint8Array");
    }

    return {
        raw: box
    };
}

function getStblBuildParamsFromBoxBytes(box) {

    function emitChild(name, emitter) {
        const childBytes = extractChildBoxFromContainer(box, name);

        const params = getGoldenTruthBox
            .fromBox(
                childBytes,
                `moov/trak/mdia/minf/stbl/${name}`
            )
            .getBuilderInput();

        return emitter(params);
    }

    return {
        stsd: emitChild("stsd", emitStsdBox),
        stts: emitChild("stts", emitSttsBox),
        stss: emitChild("stss", emitStssBox),
        ctts: emitChild("ctts", emitCttsBox),
        stsc: emitChild("stsc", emitStscBox),
        stsz: emitChild("stsz", emitStszBox),
        stco: emitChild("stco", emitStcoBox)
    };
}

export function registerStblGoldenTruthExtractor(register) {
    register.readFields(readStblBoxFieldsFromBoxBytes);
    register.getBuilderInput(getStblBuildParamsFromBoxBytes);
}
