import { readUint32 } from "../bytes/mp4ByteReader.js";
import {
    getPayloadOffsetForPath,
    getHeaderLayoutForPath,
    getBoxSchemaForPath 
} from "./boxSchemas.js";
import { HEADER_LAYOUTS } from "../box-schema/headerLayouts.js";
import { PRIMITIVE_SIZES } from "./primitiveLayouts.js";

/**
 * Reads the ISO box header fields declared by schema.
 *
 * This function:
 * - knows NOTHING about specific box types
 * - reads ONLY what the schema declares
 * - performs NO semantic interpretation
 */
export function readBoxHeaderFromBytes(boxBytes, path) {
    const layout = getHeaderLayoutForPath(path);

    if (!layout.hasVersion && !layout.hasFlags) {
        return undefined;
    }

    const header = {};

    if (layout.hasVersion) {
        header.version = boxBytes[layout.offsets.version];
    }

    if (layout.hasFlags) {
        const o = layout.offsets.flags;
        header.flags =
            (boxBytes[o]     << 16) |
            (boxBytes[o + 1] << 8)  |
            boxBytes[o + 2];
    }

    return header;
}

export function getOpaquePayloadFromBytes(boxBytes, path) {
    
    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error(
            "getBoxPayload: expected Uint8Array"
        );
    }

    if (typeof path !== "string" || path.length === 0) {
        throw new Error(
            "getOpaquePayloadFromBytes: path is required"
        );
    }

    const schema = getBoxSchemaForPath(path);
    const layout = HEADER_LAYOUTS[schema.headerLayout];

    if (!layout) {
        throw new Error(
            `getOpaquePayloadFromBytes: unknown headerLayout '${schema.headerLayout}' for '${path}'`
        );
    }

    return boxBytes.slice(layout.headerSize);
}

/**
 * Reads a fixed-count structured uint32 table.
 *
 * Layout:
 *   (uint32 × fieldCount)[count]
 *
 * Assumes:
 * - count was already read explicitly
 * - payloadOffset points to the count field
 */
export function readStructTableFromOffset({
    box,
    payloadOffset,
    count,
    fieldNames
}) {
    const values = [];
    const UINT32 = PRIMITIVE_SIZES.uint32;

    let cursor = payloadOffset + UINT32;

    for (let i = 0; i < count; i++) {
        const entry = {};

        for (const name of fieldNames) {
            entry[name] = readUint32(box, cursor);
            cursor += UINT32;
        }

        values.push(entry);
    }

    return values;
}

export function readUint32ArrayFromOffset({
    box,
    payloadOffset,
    count
}) {
    const values = [];
    const UINT32_SIZE = PRIMITIVE_SIZES.uint32;

    let cursor = payloadOffset + UINT32_SIZE;

    for (let i = 0; i < count; i++) {
        values.push(readUint32(box, cursor));
        cursor += UINT32_SIZE;
    }

    return values;
}

export function readFourCC(bytes, offset) {
    return String.fromCharCode(
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3]
    );
}

export function decodeFullBoxHeader(label, boxBytes) {
    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error("decodeFullBoxHeader: expected Uint8Array");
    }

    return {
        label,

        // ISO BMFF base box
        size:
        (boxBytes[0] << 24) |
        (boxBytes[1] << 16) |
        (boxBytes[2] << 8)  |
        boxBytes[3],

        type:
        String.fromCharCode(
            boxBytes[4],
            boxBytes[5],
            boxBytes[6],
            boxBytes[7]
        ),

        // FullBox header
        boxVersion: boxBytes[8],

        boxFlags:
        (boxBytes[9]  << 16) |
        (boxBytes[10] << 8)  |
        boxBytes[11],
    };
}

export function decodeBasicBoxHeader(label, boxBytes) {

    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error("decodeBasicBoxHeader: expected Uint8Array");
    }

    if (boxBytes.length < 8) {
        throw new Error(
            "decodeBasicBoxHeader: boxBytes too small for basic box header"
        );
    }

    return {
        label,

        // ISO BMFF base box header
        size:
        (boxBytes[0] << 24) |
        (boxBytes[1] << 16) |
        (boxBytes[2] << 8)  |
        boxBytes[3],

        type:
        String.fromCharCode(
            boxBytes[4],
            boxBytes[5],
            boxBytes[6],
            boxBytes[7]
        ),
    };
}
