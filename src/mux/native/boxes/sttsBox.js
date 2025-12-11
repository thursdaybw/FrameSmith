import { writeUint32, writeString } from "../binary/Writer.js";

/**
 * Build a minimal STTS (Decoding Time To Sample) box.
 *
 * Our MVP muxer uses a constant duration for every frame and no B-frames,
 * so STTS always contains exactly one entry:
 *
 *   entry_count = 1
 *   sample_count = number of samples
 *   sample_delta = fixed duration in MP4 timescale ticks
 *
 * @param {number} sampleCount  Number of samples in the track
 * @param {number} sampleDurationTicks  Duration of each sample (in MP4 ticks)
 * @returns {Uint8Array}
 */
export function buildSttsBox(sampleCount, sampleDurationTicks) {

    if (typeof sampleCount !== "number" || sampleCount < 0) {
        throw new Error("buildSttsBox: sampleCount must be a non-negative number");
    }

    if (typeof sampleDurationTicks !== "number" || sampleDurationTicks <= 0) {
        throw new Error("buildSttsBox: sampleDurationTicks must be a positive number");
    }

    // STTS box layout:
    // size(4) + type(4) + version(1) + flags(3)
    // entry_count(4)
    // entry:
    //   sample_count(4)
    //   sample_delta(4)
    //
    // Total size = 8 header + 4 + 4 + 8 = 24 bytes
    const boxSize = 24;
    const out = new Uint8Array(boxSize);

    // box size
    writeUint32(out, 0, boxSize);
    // box type: "stts"
    writeString(out, 4, "stts");

    // version
    out[8] = 0;

    // flags
    out[9] = 0;
    out[10] = 0;
    out[11] = 0;

    // entry_count = 1
    writeUint32(out, 12, 1);

    // sample_count
    writeUint32(out, 16, sampleCount);

    // sample_delta
    writeUint32(out, 20, sampleDurationTicks);

    return out;
}

