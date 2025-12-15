/**
 * btrt — BitRate Box
 * ------------------
 * Provides *bitrate hints* for a media stream.
 *
 * This box does NOT affect decoding.
 * It does NOT affect timing.
 * It does NOT affect sample layout.
 *
 * It exists purely as advisory metadata for players and editors.
 *
 * Why it still exists:
 * --------------------
 * - Required for historical compatibility with QuickTime-derived tooling
 * - Emitted by ffmpeg, Safari, WebCodecs pipelines
 * - Expected by some strict MP4 validators
 *
 * Framesmith policy:
 * ------------------
 * Framesmith does not attempt to infer bitrate.
 * Instead, it emits safe, conservative defaults that:
 *
 * - match common encoder output
 * - satisfy container expectations
 * - preserve byte-for-byte conformance
 *
 * External references:
 * --------------------
 * ISO/IEC 14496-12 — BitRateBox
 * MP4RA registry: https://mp4ra.org/registered-types/boxes
 */
export function buildBtrtBox({
    bufferSize = 0,
    maxBitrate = 0,
    avgBitrate = 0
} = {}) {

    // ---------------------------------------------------------------------
    // Defensive validation — btrt is advisory but must be structurally valid
    // ---------------------------------------------------------------------

    for (const [name, value] of [
        ["bufferSize", bufferSize],
        ["maxBitrate", maxBitrate],
        ["avgBitrate", avgBitrate]
    ]) {
        if (!Number.isInteger(value) || value < 0) {
            throw new Error(
                `buildBtrtBox: ${name} must be a non-negative integer`
            );
        }
    }

    return {
        type: "btrt",
        body: [
            { int: bufferSize },
            { int: maxBitrate },
            { int: avgBitrate }
        ]
    };

    return {
        type: "btrt",

        body: [
            /**
             * bufferSizeDB
             * ------------
             * Decoder buffer size in bytes.
             *
             * Historically used by hardware decoders.
             * Modern players typically ignore this.
             *
             * Set to 0 to indicate "unspecified".
             */
            { int: bufferSize },

            /**
             * maxBitrate
             * ----------
             * Maximum bitrate in bits per second.
             *
             * Advisory only.
             * Set to 0 when unknown.
             */
            { int: maxBitrate },

            /**
             * avgBitrate
             * ----------
             * Average bitrate in bits per second.
             *
             * Advisory only.
             * Set to 0 when unknown.
             */
            { int: avgBitrate }
        ]
    };
}
