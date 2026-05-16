import { readUint32 } from "../../bytes/mp4ByteReader.js";
import { readFourCC } from "../../box-schema/boxLayoutReaders.js";

/**
 * META > HDLR Golden Truth Extractor
 *
 * Schema-aligned node report.
 */
function readMetaHdlrBoxReport(boxBytes) {
    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error("metaHdlr.readBoxReport: expected Uint8Array");
    }

    return {
        raw: boxBytes,

        box: {
            type: "hdlr",

            header: {
                version: boxBytes[8],
                flags:
                    (boxBytes[9] << 16) |
                    (boxBytes[10] << 8) |
                    boxBytes[11],
            },

            fields: {
                // bytes 12..15
                zeroPadding: readUint32(boxBytes, 12),

                // bytes 16..19
                handlerType: readFourCC(boxBytes, 16),

                // bytes 20..end
                nameBytes: Array.from(boxBytes.slice(20)),
            },

        },

        derived: {}
    };
}

function getMetaHdlrEmitterInput(boxBytes) {
    return {
        nameBytes: boxBytes.slice(20)
    };
}

export function registerMetaHdlrGoldenTruthExtractor(register) {
    register.readBoxReport(readMetaHdlrBoxReport);
    register.getEmitterInput(getMetaHdlrEmitterInput);
}
