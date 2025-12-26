import { readUint32 } from "../../bytes/mp4ByteReader.js";
import { splitFixed1616 } from "../../bytes/mp4NumericFormats.js";

/**
 * TKHD Parser
 * ===========
 *
 * Test-only parser for the Track Header Box (tkhd).
 *
 * This parser:
 * - operates on isolated tkhd box bytes only
 * - performs no traversal
 * - performs no normalization or policy decisions
 *
 * It exposes two capabilities:
 *   - readFields      → full structural truth
 *   - getBuilderInput  → semantic intent required to rebuild the box
 *
 * The separation between these two capabilities is deliberate and enforced.
 */

/**
 * readTkhdBoxFieldsFromBoxBytes
 * -----------------------------
 *
 * Reads the complete structural contents of a tkhd box.
 *
 * This function answers:
 *   “What does the file contain?”
 *
 * It preserves:
 *   - raw fixed-point representations
 *   - raw flag values
 *   - raw bytes for byte-level comparison
 *
 * @param {Uint8Array} box
 * @returns {Object}
 */
function readTkhdBoxFieldsFromBoxBytes(box) {
    if (!(box instanceof Uint8Array)) {
        throw new Error(
            "tkhd.readFields: expected Uint8Array box bytes"
        );
    }

    const version = box[8];

    const flags =
        (box[9]  << 16) |
        (box[10] << 8)  |
        box[11];

    return {
        type: "tkhd",

        version,
        flags,

        trackId:  readUint32(box, 20),
        duration: readUint32(box, 28),

        // 16.16 fixed-point values, preserved verbatim
        widthFixed:  readUint32(box, 84),
        heightFixed: readUint32(box, 88),

        raw: box
    };
}

/**
 * getTkhdBuildParamsFromBoxBytes
 * ------------------------------
 *
 * Extracts the exact semantic parameters required to rebuild
 * a tkhd box using Framesmith builders.
 *
 * This function answers:
 *   “What intent must be preserved to rebuild this box?”
 *
 * It:
 * - interprets fixed-point values using MP4 numeric conventions
 * - does NOT normalize or invent values
 *
 * @param {Uint8Array} box
 * @returns {Object}
 */
function getTkhdBuildParamsFromBoxBytes(box) {
    const fields = readTkhdBoxFieldsFromBoxBytes(box);

    const width  = splitFixed1616(fields.widthFixed);
    const height = splitFixed1616(fields.heightFixed);

    return {
        width:          width.integer,
        height:         height.integer,
        widthFraction:  width.fraction,
        heightFraction: height.fraction,
        duration:       fields.duration,
        trackId:        fields.trackId
    };
}

/**
 * registerTkhdParser
 * ------------------
 *
 * Registers the tkhd parser into the test parser registry.
 *
 * This is the ONLY public export of this module.
 */
export function registerTkhdGoldenTruthExtractor(register) {
    register.readFields(readTkhdBoxFieldsFromBoxBytes);
    register.getBuilderInput(getTkhdBuildParamsFromBoxBytes);
}
