import { extractChildBoxFromContainer } from "../reference/BoxExtractor.js";
import { getGoldenTruthBox } from "./index.js";
import { emitMetaHdlrBox } from "../../box-emitters/metaHdlrBox.js";
import { emitIlstBox } from "../../box-emitters/ilstBox.js";

function readMetaBoxFieldsFromBoxBytes(box) {
    return { raw: box };
}

function getMetaBuilderInputFromBoxBytes(box) {

    const hdlrBytes = extractChildBoxFromContainer(box, "hdlr");
    const ilstBytes = extractChildBoxFromContainer(box, "ilst");

    // ---------------------------------------------
    // Golden truth → params → emit → NODE
    // ---------------------------------------------
    const hdlrNode = emitMetaHdlrBox(
        getGoldenTruthBox
            .fromBox(hdlrBytes, "moov/udta/meta/hdlr")
            .getBuilderInput()
    );

    const ilstNode = emitIlstBox(
        getGoldenTruthBox
            .fromBox(ilstBytes, "moov/udta/meta/ilst")
            .getBuilderInput()
    );

    // ---------------------------------------------
    // EXACT emitMetaBox input
    // ---------------------------------------------
    return {
        hdlr: hdlrNode,
        ilst: ilstNode
    };
}

export function registerMetaGoldenTruthExtractor(register) {
    register.readFields(readMetaBoxFieldsFromBoxBytes);
    register.getBuilderInput(getMetaBuilderInputFromBoxBytes);
}
