import { writeUint32, writeString } from "../binary/Writer.js";

/**
 * VMHD — Video Media Header Box
 * ----------------------------
 * Declares video-specific media defaults for a track.
 *
 * This box originates from the QuickTime file format and was
 * carried forward into the ISO Base Media File Format (MP4).
 *
 * In modern playback pipelines, the fields in this box are
 * effectively ignored, but the box itself is still *required*
 * for video tracks to be considered structurally valid.
 *
 * Think of vmhd as:
 *   “This track is video, and here are its historical defaults.”
 *
 * It does not describe codec behavior, timing, or samples.
 * It exists to satisfy the container contract.
 */
export function emitVmhdBox() {
    return {
        type: "vmhd",

        // FullBox header (see FullBox.md)
        // - The MP4 specification defines only version 0
        // - The specification mandates that the lowest-order flag bit is set
        version: 0,
        flags: 1,

        body: [
            /**
             * graphicsmode (ushort)
             * --------------------
             * Historical QuickTime field controlling how video pixels
             * were composited over a background (e.g. copy, blend, XOR).
             *
             * In modern MP4 playback:
             * - This value is ignored
             * - Hardware decoders do not consult it
             * - Players do not validate it
             *
             * The specification requires the field to exist,
             * but defines no meaningful behavior for non-zero values.
             *
             * Framesmith sets this to 0 (“copy”) as the canonical,
             * safest value used by reference encoders.
             */
            { short: 0 },

            /**
             * opcolor[0] (ushort)
             * ------------------
             * Legacy background color value (red channel).
             *
             * This field comes from very old video systems where the container
             * defined a background color for compositing video frames.
             *
             * In modern MP4 playback:
             * - This value is ignored
             * - Decoders do not read it
             * - Players do not use it
             *
             * The field still exists because the MP4 format requires it.
             * Framesmith sets it to 0 to match reference encoders and ensure
             * strict format conformance.
             */
            { short: 0 },

            /**
             * Legacy background color value (green channel).
             *
             * This field comes from very old video systems where the container
             * defined a background color for compositing video frames.
             *
             * In modern MP4 playback:
             * - This value is ignored
             * - Decoders do not read it
             * - Players do not use it
             *
             * The field still exists because the MP4 format requires it.
             * Framesmith sets it to 0 to match reference encoders and ensure
             * strict format conformance.
             */
            { short: 0 },

            /**
             * Legacy background color value (blue channel).
             *
             * This field comes from very old video systems where the container
             * defined a background color for compositing video frames.
             *
             * In modern MP4 playback:
             * - This value is ignored
             * - Decoders do not read it
             * - Players do not use it
             *
             * The field still exists because the MP4 format requires it.
             * Framesmith sets it to 0 to match reference encoders and ensure
             * strict format conformance.
             */
            { short: 0 },
        ]
    };
}
