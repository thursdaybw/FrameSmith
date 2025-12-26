import { extractChildBoxFromContainer } from "../reference/BoxExtractor.js";
import { getGoldenTruthBox } from "./index.js";
import { emitVmhdBox } from "../../box-emitters/vmhdBox.js";
import { emitDinfBox } from "../../box-emitters/dinfBox.js";
import { emitStblBox } from "../../box-emitters/stblBox.js";


/**
 * MINF — Media Information Box
 * ===========================
 *
 * Golden truth extractor for minf.
 *
 * Responsibilities:
 * - validate required children exist
 * - delegate truth extraction to child extractors
 * - return exact builder input for buildMinfBox
 *
 * Required children (video track):
 *   - vmhd
 *   - dinf
 *   - stbl
 */

function readMinfBoxFieldsFromBoxBytes(box) {
    if (!(box instanceof Uint8Array)) {
        throw new Error("minf.readFields: expected Uint8Array");
    }

    const vmhdBytes = extractChildBoxFromContainer(box, "vmhd");
    const dinfBytes = extractChildBoxFromContainer(box, "dinf");
    const stblBytes = extractChildBoxFromContainer(box, "stbl");

    if (!vmhdBytes) {
        throw new Error("minf.readFields: missing required child 'vmhd'");
    }
    if (!dinfBytes) {
        throw new Error("minf.readFields: missing required child 'dinf'");
    }
    if (!stblBytes) {
        throw new Error("minf.readFields: missing required child 'stbl'");
    }

    return {
        vmhdBytes,
        dinfBytes,
        stblBytes,
        raw: box
    };
}

function getMinfEmitterInputFromBoxBytes(box) {
    const parsed = readMinfBoxFieldsFromBoxBytes(box);

    const vmhdNode = emitVmhdBox();

    const dinfParams = getGoldenTruthBox
        .fromBox(parsed.dinfBytes, "moov/trak/mdia/minf/dinf")
        .getBuilderInput();

    const stblParams = getGoldenTruthBox
        .fromBox(parsed.stblBytes, "moov/trak/mdia/minf/stbl")
        .getBuilderInput();

    return {
        vmhd: vmhdNode,
        dinf: emitDinfBox(dinfParams),
        stbl: emitStblBox(stblParams),
    };
}

export function registerMinfGoldenTruthExtractor(register) {
    register.readFields(readMinfBoxFieldsFromBoxBytes);
    register.getBuilderInput(getMinfEmitterInputFromBoxBytes);
}
