import { writeUint32, writeString } from "../binary/Writer.js";

/**
 * VMHD — Video Media Header Box
 * ============================
 *
 * IMPORTANT DESIGN NOTE (READ THIS FIRST)
 * ---------------------------------------
 *
 * Framesmith deliberately emits a *canonical*, compiler-owned vmhd box.
 *
 * This is an intentional architectural decision.
 *
 * Why?
 * ----
 * vmhd is a legacy QuickTime header whose fields:
 *   - have no effect on modern playback
 *   - are ignored by decoders
 *   - do not participate in timing, codec configuration, or rendering
 *
 * The MP4 specification requires vmhd to exist for video tracks,
 * but does NOT assign semantic meaning to its contents in modern pipelines.
 *
 * In practice, reference encoders (including ffmpeg) always emit:
 *   - version: 0
 *   - flags: 1
 *   - graphicsmode: 0
 *   - opcolor: [0, 0, 0]
 *
 * Framesmith therefore treats vmhd as:
 *   “structural boilerplate required for container validity”
 *
 * NOT as semantic input.
 *
 * Consequence for Golden Oracle Tests
 * ----------------------------------
 *
 * Framesmith NORMALIZES vmhd by design.
 *
 * This means:
 *   - Byte-for-byte conformance tests are expected to match this canonical vmhd
 *   - If a future golden MP4 contains a different vmhd payload,
 *     the byte mismatch will appear *inside vmhd*
 *
 * In that situation:
 *   - Playback correctness is NOT affected
 *   - Semantic correctness is NOT affected
 *   - The compiler is behaving as designed
 *
 * The test must either:
 *   - accept vmhd normalization, or
 *   - explicitly special-case vmhd comparison
 *
 * This is not a bug.
 * This is a documented normalization boundary.
 *
 * If lossless structural reproduction is ever required,
 * it must be implemented as a *separate source adapter*,
 * not by changing this emitter.
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
