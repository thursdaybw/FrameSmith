import { readFourCC } from "../box-schema/boxLayoutReaders.js";

/**
 * getSampleEntryTableFromStsdAsList
 * =================================
 *
 * Reads the SampleEntry table from an `stsd` box and returns it
 * as a positional list.
 *
 * What this does
 * --------------
 * - Parses the non-container `stsd` layout
 * - Reads the count-prefixed SampleEntry table
 * - Returns structural metadata only
 *
 * What this does NOT do
 * --------------------
 * - Does NOT return SampleEntry bytes
 * - Does NOT infer codecs
 * - Does NOT apply policy
 * - Does NOT traverse child boxes
 *
 * Why this exists
 * ---------------
 * `stsd` is NOT an ISO BMFF container.
 * SampleEntry records are stored as a fixed-layout table and
 * must be traversed explicitly.
 *
 * This function is the single source of truth for:
 * - SampleEntry count
 * - SampleEntry offsets
 * - SampleEntry sizes
 * - SampleEntry FourCC types
 *
 * @param {Uint8Array} stsdBox
 * @returns {Array<{ type: string, offset: number, size: number }>}
 */
export function getSampleEntryTableFromStsdAsList(stsdBox) {

    // stsd layout:
    // size (4)
    // type (4)
    // version (1)
    // flags (3)
    // entry_count (4)

    const entryCount =
        (stsdBox[12] << 24) |
        (stsdBox[13] << 16) |
        (stsdBox[14] << 8)  |
        stsdBox[15];

    let offset = 16;
    const entries = [];

    for (let i = 0; i < entryCount; i++) {

        const size =
            (stsdBox[offset]     << 24) |
            (stsdBox[offset + 1] << 16) |
            (stsdBox[offset + 2] << 8)  |
            stsdBox[offset + 3];

        const type = readFourCC(stsdBox, offset + 4);

        entries.push({
            type,
            offset,
            size
        });

        offset += size;
    }

    return entries;
}
