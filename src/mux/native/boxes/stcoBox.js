import { writeUint32, writeString } from "../binary/Writer.js";

/**
 * Build an STCO (Chunk Offset Box).
 *
 * This box lists the byte offsets of every chunk within the final MP4 file.
 *
 * IMPORTANT ARCHITECTURAL NOTE:
 * --------------------------------
 * The muxer (NativeMuxer) is responsible for computing the actual chunk
 * offsets after all boxes are sized and placed. BoxBuilder does NOT compute
 * offsets. It only SERIALIZES the offsets it is given.
 *
 * This function is pure: it accepts an array of offsets (numbers) and
 * produces the STCO box encoding. It has no knowledge of how offsets were
 * obtained.
 *
 * Structure:
 *   size(4)
 *   type "stco"(4)
 *   version(1)
 *   flags(3)
 *   entry_count(4)
 *   entries:
 *       chunk_offset(4) repeated entry_count times
 *
 * @param {number[]} chunkOffsets  Array of byte offsets for each chunk.
 * @returns {Uint8Array}
 */
export function buildStcoBox(chunkOffsets) {


    if (!Array.isArray(chunkOffsets)) {
        throw new Error("buildStcoBox: chunkOffsets must be an array");
    }

    for (const off of chunkOffsets) {
        if (typeof off !== "number" || off < 0) {
            throw new Error("buildStcoBox: all offsets must be non-negative numbers");
        }
    }

    const count = chunkOffsets.length;

    // Base size: 16 + (4 * entry_count)
    const boxSize = 16 + (count * 4);
    const out = new Uint8Array(boxSize);

    // size
    writeUint32(out, 0, boxSize);

    // type = "stco"
    writeString(out, 4, "stco");

    // version and flags (all zero)
    out[8] = 0;
    out[9] = 0;
    out[10] = 0;
    out[11] = 0;

    // entry_count
    writeUint32(out, 12, count);

    // entries
    let offset = 16;
    for (let i = 0; i < count; i++) {
        writeUint32(out, offset, chunkOffsets[i]);
        offset += 4;
    }

    return out;
}
