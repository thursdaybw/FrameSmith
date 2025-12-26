import { readFourCC } from "../../bytes/mp4ByteReader.js";

/**
 * META > HDLR Golden Truth Extractor
 *
 * Emits EXACT input required by emitMetaHdlrBox.
 *
 * Contract:
 *   emitMetaHdlrBox({
 *     nameBytes: Uint8Array
 *   })
 */
function readMetaHdlrFieldsFromBoxBytes(box) {
    if (!(box instanceof Uint8Array)) {
        throw new Error("metaHdlr.readFields: expected Uint8Array");
    }

    return {
        handlerType: readFourCC(box, 16),
        raw: box
    };
}

function getMetaHdlrBuilderInputFromBoxBytes(box) {
    // bytes 20..end = name bytes + padding
    return {
        nameBytes: box.slice(20)
    };
}

export function registerMetaHdlrGoldenTruthExtractor(register) {
    register.readFields(readMetaHdlrFieldsFromBoxBytes);
    register.getBuilderInput(getMetaHdlrBuilderInputFromBoxBytes);
}
