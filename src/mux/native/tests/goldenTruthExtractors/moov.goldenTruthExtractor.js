import { getGoldenTruthBox } from "./index.js";

import { emitMvhdBox } from "../../box-emitters/mvhdBox.js";
import { emitTrakBox } from "../../box-emitters/trakBox.js";
import { emitUdtaBox } from "../../box-emitters/udtaBox.js";

import { asContainer } from "../../box-model/Box.js";

function readMoovBoxFieldsFromBoxBytes(boxBytes) {
    return {
        raw: boxBytes
    };
}

function getMoovEmitterInputFromBoxBytes(moovBoxBytes) {

    const container = asContainer(moovBoxBytes);
    const children  = container.enumerateChildren();

    // --------------------------------------------------
    // mvhd (required)
    // --------------------------------------------------
    let mvhd;

    for (const child of children) {
        if (child.type !== "mvhd") continue;

        const mvhdBoxBytes = moovBoxBytes.slice(
            child.offset,
            child.offset + child.size
        );

        const mvhdParams = getGoldenTruthBox
            .fromBox(mvhdBoxBytes, "moov/mvhd")
            .getBuilderInput();

        mvhd = emitMvhdBox(mvhdParams);
        break;
    }

    if (!mvhd) {
        throw new Error("moov truth extractor: mvhd box not found");
    }

    // --------------------------------------------------
    // trak(s) (required)
    // --------------------------------------------------
    const traks = [];

    for (const child of children) {
        if (child.type !== "trak") continue;

        const trakBoxBytes = moovBoxBytes.slice(
            child.offset,
            child.offset + child.size
        );

        const trakParams = getGoldenTruthBox
            .fromBox(trakBoxBytes, "moov/trak")
            .getBuilderInput();

        traks.push(emitTrakBox(trakParams));
    }

    if (traks.length === 0) {
        throw new Error("moov truth extractor: no trak boxes found");
    }

    // --------------------------------------------------
    // udta (optional)
    // --------------------------------------------------
    let udta;

    for (const child of children) {
        if (child.type !== "udta") continue;

        const udtaBoxBytes = moovBoxBytes.slice(
            child.offset,
            child.offset + child.size
        );

        const udtaParams = getGoldenTruthBox
            .fromBox(udtaBoxBytes, "moov/udta")
            .getBuilderInput();

        udta = emitUdtaBox(udtaParams);
        break;
    }

    return { mvhd, traks, udta };
}

export function registerMoovGoldenTruthExtractor(register) {
    register.readFields(readMoovBoxFieldsFromBoxBytes);
    register.getBuilderInput(getMoovEmitterInputFromBoxBytes);
}
