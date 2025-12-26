import { readUint16, readUint32, readFourCC } from "../../bytes/mp4ByteReader.js";

/**
 * VMHD — Video Media Header Box
 * =============================
 *
 * Golden truth extractor for vmhd.
 *
 * This module:
 * - reads structural truth from isolated vmhd box bytes
 * - extracts the exact builder input required to rebuild vmhd
 *
 * It does NOT:
 * - perform MP4 traversal
 * - build boxes
 * - apply defaults
 * - encode policy
 *
 * vmhd is a FullBox with a fixed, canonical layout.
 */

/**
 * readVmhdBoxFieldsFromBoxBytes
 * -----------------------------
 *
 * Returns complete structural truth for inspection and
 * byte-level equivalence testing.
 *
 * @param {Uint8Array} box
 * @returns {Object}
 */
function readVmhdBoxFieldsFromBoxBytes(box) {
    if (!(box instanceof Uint8Array)) {
        throw new Error(
            "vmhd.readFields: expected Uint8Array box bytes"
        );
    }

    const size = readUint32(box, 0);
    const type = readFourCC(box, 4);

    if (type !== "vmhd") {
        throw new Error(
            `vmhd.readFields: expected 'vmhd', got '${type}'`
        );
    }

    const version = box[8];
    const flags =
        (box[9]  << 16) |
        (box[10] << 8)  |
        box[11];

    const graphicsmode = readUint16(box, 12);

    const opcolor = [
        readUint16(box, 14),
        readUint16(box, 16),
        readUint16(box, 18),
    ];

    return {
        type,
        size,
        version,
        flags,
        graphicsmode,
        opcolor,
        raw: box
    };
}

/**
 * getVmhdBuilderInputFromBoxBytes
 * -------------------------------
 *
 * Returns exactly the input object required by buildVmhdBox.
 *
 * IMPORTANT:
 * vmhd has no semantic variability in Framesmith.
 * The builder emits a canonical vmhd with fixed values.
 *
 * Therefore:
 * - this function returns an empty object
 * - but still exists to enforce the invariant
 *
 * @param {Uint8Array} box
 * @returns {Object}
 */
function getVmhdBuilderInputFromBoxBytes(box) {
    // Structural validation only
    readVmhdBoxFieldsFromBoxBytes(box);

    return {};
}

/**
 * registerVmhdGoldenTruthExtractor
 * --------------------------------
 *
 * Registers vmhd golden truth extractor capabilities.
 */
export function registerVmhdGoldenTruthExtractor(register) {
    register.readFields(readVmhdBoxFieldsFromBoxBytes);
    register.getBuilderInput(getVmhdBuilderInputFromBoxBytes);
}
