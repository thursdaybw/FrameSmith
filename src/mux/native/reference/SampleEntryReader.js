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

/**
 * Return the fixed header size for a SampleEntry type.
 *
 * This is codec-defined structural knowledge.
 */
export function getSampleEntryHeaderSize(sampleType) {
    switch (sampleType) {
        case "avc1":
        case "hev1":
        case "hvc1":
            return 78;

        case "mp4a":
            return 28;

        default:
            throw new Error(
                `Unknown SampleEntry type '${sampleType}'`
            );
    }
}

/**
 * Reader for a single SampleEntry box.
 */
export class SampleEntryReader {

    constructor(sampleEntryBytes, headerSize) {
        if (!(sampleEntryBytes instanceof Uint8Array)) {
            throw new Error("SampleEntryReader: expected Uint8Array");
        }

        if (!Number.isInteger(headerSize) || headerSize <= 0) {
            throw new Error("SampleEntryReader: invalid headerSize");
        }

        this.bytes = sampleEntryBytes;
        this.headerSize = headerSize;
    }

    /**
     * Enumerate child boxes inside the SampleEntry.
     *
     * @returns {Array<{ type: string, offset: number, size: number }>}
     */
    enumerateChildren() {
        const children = [];
        let offset = 8 + this.headerSize;

        while (offset + 8 <= this.bytes.length) {
            const size =
                (this.bytes[offset]     << 24) |
                (this.bytes[offset + 1] << 16) |
                (this.bytes[offset + 2] << 8)  |
                this.bytes[offset + 3];

            if (size < 8) {
                break;
            }

            const type = readFourCC(this.bytes, offset + 4);

            children.push({
                type,
                offset,
                size
            });

            offset += size;
        }

        return children;
    }

    /**
     * Extract a specific child box by FourCC.
     *
     * @param {string} fourcc
     * @returns {Uint8Array}
     */
    getChild(fourcc) {
        const children = this.enumerateChildren();

        const match = children.find(c => c.type === fourcc);

        if (!match) {
            throw new Error(
                `SampleEntry does not contain child '${fourcc}'`
            );
        }

        return this.bytes.slice(
            match.offset,
            match.offset + match.size
        );
    }
}
