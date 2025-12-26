import { readUint32, readUint16 } from "../../bytes/mp4ByteReader.js";

/**
 * MDHD Parser
 * ===========
 *
 * Test-only parser for the Media Header Box (mdhd).
 *
 * Responsibilities:
 * - read structural truth from isolated mdhd box bytes
 * - extract semantic parameters required to rebuild the box
 *
 * This parser:
 * - performs NO traversal
 * - performs NO policy decisions
 * - does NOT build boxes
 */

/**
 * readMdhdBoxFieldsFromBoxBytes
 * -----------------------------
 *
 * Answers:
 *   "What does this mdhd box contain?"
 */
function readMdhdBoxFieldsFromBoxBytes(box) {
    if (!(box instanceof Uint8Array)) {
        throw new Error("mdhd.readFields: expected Uint8Array");
    }

    const version = box[8];
    const flags =
        (box[9]  << 16) |
        (box[10] << 8)  |
        box[11];

    return {
        type: "mdhd",

        version,
        flags,

        timescale: readUint32(box, 20),
        duration:  readUint32(box, 24),
        language:  readUint16(box, 28),

        raw: box
    };
}

/**
 * getMdhdBuildParamsFromBoxBytes
 * ------------------------------
 *
 * Answers:
 *   "What semantic intent is required to rebuild this mdhd box?"
 */
function getMdhdBuildParamsFromBoxBytes(box) {
    const fields = readMdhdBoxFieldsFromBoxBytes(box);

    return {
        timescale: fields.timescale,
        duration:  fields.duration
    };
}

/**
 * registerMdhdParser
 * ------------------
 *
 * The ONLY public export.
 */
export function registerMdhdGoldenTruthExtractor(register) {
    register.readFields(readMdhdBoxFieldsFromBoxBytes);
    register.getBuilderInput(getMdhdBuildParamsFromBoxBytes);
}
