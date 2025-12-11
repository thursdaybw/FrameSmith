import { writeUint32, writeString } from "../binary/Writer.js";

/**
 * Build a minimal STSC box for constant 1-sample-per-chunk layout.
 *
 * Structure:
 *   size (4)
 *   type "stsc" (4)
 *   version (1)
 *   flags (3)
 *   entry_count (4)
 *
 *   entries:
 *     first_chunk (4)
 *     samples_per_chunk (4)
 *     sample_description_index (4)
 *
 * Our MVP muxer always uses:
 *   entry_count = 1
 *   { first_chunk: 1, samples_per_chunk: 1, sample_description: 1 }
 *
 * @returns {Uint8Array}
 */
export function buildStscBox() {

    // For V1, we always produce exactly one entry.
    const ENTRY_COUNT = 1;

    // Box size calculation:
    // header (8) +
    // version+flags (4) +
    // entry_count (4) +
    // 1 entry * 12 bytes
    const boxSize = 8 + 4 + 4 + (ENTRY_COUNT * 12);

    const out = new Uint8Array(boxSize);

    // box size
    writeUint32(out, 0, boxSize);

    // type
    writeString(out, 4, "stsc");

    // version
    out[8] = 0;

    // flags
    out[9] = 0;
    out[10] = 0;
    out[11] = 0;

    // entry_count
    writeUint32(out, 12, ENTRY_COUNT);

    // entry fields
    let offset = 16;

    // first_chunk = 1
    writeUint32(out, offset, 1);
    offset += 4;

    // samples_per_chunk = 1 (our muxer uses one-sample-per-chunk layout)
    writeUint32(out, offset, 1);
    offset += 4;

    // sample_description_index = 1 (first entry in stsd)
    writeUint32(out, offset, 1);

    return out;
}

