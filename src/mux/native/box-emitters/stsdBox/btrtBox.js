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
export function emitBtrtBox({
    bufferSizeDB,
    maxBitrate,
    avgBitrate
}) {

    // -------------------------------------------------------------
    // Defensive validation (structure only, no semantics)
    // -------------------------------------------------------------
    for (const [name, value] of [
        ["bufferSizeDB", bufferSizeDB],
        ["maxBitrate",   maxBitrate],
        ["avgBitrate",   avgBitrate]
    ]) {
        if (!Number.isInteger(value) || value < 0) {
            throw new Error(
                `emitBtrtBox: ${name} must be a non-negative integer`
            );
        }
    }

    // -------------------------------------------------------------
    // Emit opaque payload
    // -------------------------------------------------------------
    return {
        type: "btrt",
        body: [
            { int: bufferSizeDB },
            { int: maxBitrate   },
            { int: avgBitrate   }
        ]
    };
}
