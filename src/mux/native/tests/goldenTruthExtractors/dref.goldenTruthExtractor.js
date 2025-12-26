import { readUint32, readFourCC } from "../../bytes/mp4ByteReader.js";

/**
 * DREF — Data Reference Box Parser (Framesmith)
 * ============================================
 *
 * Framesmith supports exactly ONE canonical form:
 *
 *   dref
 *     └─ url  (version 0, flags = 1, no payload)
 *
 * This parser:
 *   - validates that invariant
 *   - rejects anything else
 *
 * It does NOT return semantic data,
 * because buildDrefBox takes no parameters.
 */

function readDrefBoxFieldsFromBoxBytes(box) {
    if (!(box instanceof Uint8Array)) {
        throw new Error("dref.readFields: expected Uint8Array");
    }

    const version = box[8];
    const flags =
        (box[9] << 16) |
        (box[10] << 8) |
        box[11];

    if (version !== 0 || flags !== 0) {
        throw new Error(
            `dref: unsupported version/flags (${version}, ${flags})`
        );
    }

    const entryCount = readUint32(box, 12);

    if (entryCount !== 1) {
        throw new Error(
            `dref: expected exactly 1 entry, found ${entryCount}`
        );
    }

    // First child starts immediately after FullBox header + entry_count
    const childOffset = 16;

    const childSize = readUint32(box, childOffset);
    const childType = readFourCC(box, childOffset + 4);

    if (childType !== "url ") {
        throw new Error(
            `dref: expected 'url ' entry, found '${childType}'`
        );
    }

    const childVersion = box[childOffset + 8];
    const childFlags =
        (box[childOffset + 9] << 16) |
        (box[childOffset + 10] << 8) |
        box[childOffset + 11];

    if (childVersion !== 0 || childFlags !== 1) {
        throw new Error(
            "dref: url entry must be version 0, flags = 1 (self-contained)"
        );
    }

    // url self-contained entry must have no payload
    if (childSize !== 12) {
        throw new Error(
            `dref: self-contained url entry must be 12 bytes, got ${childSize}`
        );
    }

    return {
        raw: box
    };
}

function getDrefBuildParamsFromBoxBytes(box) {
    // Validation already performed
    readDrefBoxFieldsFromBoxBytes(box);

    // No params required for buildDrefBox
    return {};
}

export function registerDrefGoldenTruthExtractor(register) {
    register.readFields(readDrefBoxFieldsFromBoxBytes);
    register.getBuilderInput(getDrefBuildParamsFromBoxBytes);
}
