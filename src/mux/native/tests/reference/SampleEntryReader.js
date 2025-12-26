import { readUint32, readFourCC } from "../../bytes/mp4ByteReader.js";

/**
 * SampleEntryReader
 * -----------------
 * Reads child boxes embedded inside a SampleEntry (e.g. avc1).
 *
 * This abstraction exists because SampleEntry is NOT a normal MP4 box:
 * it has a fixed header followed by child boxes at a variable offset.
 *
 * This is a test-side adapter, not production code.
 */
export class SampleEntryReader {
    constructor(bytes, headerSize) {
        this.bytes = bytes;
        this.headerSize = headerSize;
    }

    /**
     * Return all child boxes found after the SampleEntry header.
     */
    listChildren() {
        const children = [];
        let offset = this.headerSize;

        while (offset + 8 <= this.bytes.length) {
            const size = readUint32(this.bytes, offset);
            const type = readFourCC(this.bytes, offset + 4);

            if (size < 8) {
                throw new Error(
                    `Invalid child box size (${size}) at offset ${offset}`
                );
            }

            children.push({
                type,
                start: offset,
                size,
                raw: this.bytes.slice(offset, offset + size)
            });

            offset += size;
        }

        return children;
    }

    /**
     * Extract a specific child box by FourCC.
     */
    getChild(type) {
        const hits = this.listChildren().filter(b => b.type === type);

        if (hits.length === 0) {
            throw new Error(
                `FAIL: child box '${type}' not found in SampleEntry`
            );
        }

        if (hits.length > 1) {
            throw new Error(
                `FAIL: multiple '${type}' boxes found in SampleEntry`
            );
        }

        return hits[0].raw;
    }
}
