import { readUint32, readFourCC } from "../../bytes/mp4ByteReader.js";

/**
 * FREE — Free Space Box (Golden Truth Extractor)
 * =============================================
 *
 * Framesmith supports exactly ONE canonical form:
 *
 *   - size = 8
 *   - type = "free"
 *   - no payload
 *
 * This extractor:
 *   - validates that invariant against a real MP4
 *   - provides zero builder input (emitFreeBox takes no params)
 *
 * Any deviation is rejected explicitly.
 */

function readFreeBoxFieldsFromBoxBytes(box) {
    if (!(box instanceof Uint8Array)) {
        throw new Error("free.readFields: expected Uint8Array");
    }

    const size = readUint32(box, 0);
    const type = readFourCC(box, 4);

    if (type !== "free") {
        throw new Error(`free: expected type 'free', got '${type}'`);
    }

    if (size !== 8) {
        throw new Error(
            `free: Framesmith only supports minimal 8-byte free box, got size ${size}`
        );
    }

    if (box.length !== 8) {
        throw new Error(
            `free: box length mismatch (expected 8, got ${box.length})`
        );
    }

    return {
        raw: box
    };
}

function getFreeBuildParamsFromBoxBytes(box) {
    // Validation already performed
    readFreeBoxFieldsFromBoxBytes(box);

    // emitFreeBox takes no parameters
    return {};
}

export function registerFreeGoldenTruthExtractor(register) {
    register.readFields(readFreeBoxFieldsFromBoxBytes);
    register.getBuilderInput(getFreeBuildParamsFromBoxBytes);
}
