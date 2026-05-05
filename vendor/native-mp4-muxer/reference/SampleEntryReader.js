// SampleEntryReader.js
//
// Structural reader for SampleEntry boxes (avc1, mp4a, etc).
//
// SampleEntry boxes are NOT ISO BMFF containers.
// Child boxes begin after a codec-defined fixed header.
//
// This module encapsulates that exception explicitly.
//
// It does NOT:
// - traverse MP4 box trees
// - infer codecs
// - decode payloads
// - apply policy
//
// It ONLY:
// - scans SampleEntry bytes structurally
// - returns raw child box bytes

import { readFourCC } from "../box-schema/boxLayoutReaders.js";
import { getBoxSchemaForPath, getPayloadOffsetForPath } from "../box-schema/boxSchemas.js";

/**
 * Return the fixed header size for a SampleEntry type.
 *
 * This is codec-defined structural knowledge.
 */
export function getSampleEntryHeaderSize(sampleType) {
    console.warn(
        "getSampleEntryHeaderSize(sampleType) is transitional.\n" +
        "It now returns sampleEntry.childrenOffset.\n" +
        "Use SampleEntryReader or schema.sampleEntry.childrenOffset directly."
    );

    const schema = getSampleEntrySchemaByType(sampleType);

    if (
        !schema.sampleEntry ||
        !Number.isInteger(schema.sampleEntry.childrenOffset)
    ) {
        throw new Error(
            `SampleEntry schema missing sampleEntry.childrenOffset for ${sampleType}`
        );
    }

    return schema.sampleEntry.childrenOffset;
}

function getSampleEntryFixedFieldsSize(sampleType) {

    if (typeof sampleType !== "string" || sampleType.length !== 4) {
        throw new Error(
            `getSampleEntryFixedFieldsSize: invalid sampleType '${sampleType}'`
        );
    }

    const path = sampleEntryTypeToPath(sampleType);
    const schema = getBoxSchemaForPath(path);

    if (!Number.isInteger(schema.sampleEntry.fixedFieldsSize)) {
        throw new Error(
            [
                "SampleEntry schema is missing required information.",
                "",
                `What happened:`,
                `  The schema for '${path}' was found,`,
                "  but it does not define 'sampleEntryFixedFieldsSize'.",
                "",
                "Why this matters:",
                "  SampleEntry child boxes do NOT start immediately after the ISO header.",
                "  They start after a codec-defined block of fixed fields.",
                "",
                "What this function expected:",
                "  schema.sampleEntryFixedFieldsSize = <number of fixed bytes>",
                "",
                "How to fix it:",
                "  Add 'sampleEntryFixedFieldsSize' to the SampleEntry schema",
                "  for this codec (for example avc1 or mp4a)."
            ].join("\n")
        );
    }

    return schema.sampleEntryFixedFieldsSize;
}

export function getSampleEntrySchemaByType(sampleType) {
    const path = sampleEntryTypeToPath(sampleType);
    return getBoxSchemaForPath(path);
}

function sampleEntryTypeToPath(sampleType) {
    return `moov/trak/mdia/minf/stbl/stsd|${sampleType}`;
}

/**
 * Reader for a single SampleEntry box.
 */
export class SampleEntryReader {

    constructor(sampleEntryBytes, sampleEntryType) {
        if (!(sampleEntryBytes instanceof Uint8Array)) {
            throw new Error(
                "SampleEntryReader: expected Uint8Array\n" +
                `Recieved: ${sampleEntryBytes}`
            );
        }

        if (typeof sampleEntryType !== "string" || sampleEntryType.length !== 4) {
            throw new Error(`SampleEntryReader: invalid sampleEntryType (${sampleEntryType})`);
        }

        const schema = getSampleEntrySchemaByType(sampleEntryType);

        if (
            !schema.sampleEntry ||
            !Number.isInteger(schema.sampleEntry.childrenOffset)
        ) {
            throw new Error(
                `SampleEntryReader: schema missing sampleEntry.childrenOffset for ${sampleEntryType}`
            );
        }

        this.bytes = sampleEntryBytes;
        this.childrenOffset = schema.sampleEntry.childrenOffset;
    }

    enumerateChildren() {
        const children = [];
        let offset = this.childrenOffset;

        while (offset + 8 <= this.bytes.length) {
            const size =
                (this.bytes[offset]     << 24) |
                (this.bytes[offset + 1] << 16) |
                (this.bytes[offset + 2] << 8)  |
                this.bytes[offset + 3];

            if (size < 8) break;

            const type = readFourCC(this.bytes, offset + 4);

            children.push({ type, offset, size });

            offset += size;
        }

        return children;
    }

    getChild(fourcc) {
        const match =
            this.enumerateChildren().find(c => c.type === fourcc);

        if (!match) {
            throw new Error(`SampleEntry does not contain child '${fourcc}'`);
        }

        return this.bytes.slice(match.offset, match.offset + match.size);
    }
}
