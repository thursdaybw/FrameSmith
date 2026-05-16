import { requireCodecProfileByCodecName } from "../codecs/codecRegistry.js";

/**
 * applyEditListPolicy
 * ===================
 *
 * Container policy for emitting an Edit List (`edts` / `elst`) that matches
 * the observed default behavior of ffmpeg for a simple, single-track MP4.
 *
 * ============================================================================
 * WHY THIS POLICY EXISTS
 * ============================================================================
 *
 * Edit Lists are NOT semantic media facts.
 *
 * They are a container-level construct used to map a track’s internal
 * media timeline (mdhd) into the movie’s presentation timeline (mvhd).
 *
 * The MP4 specification explicitly allows multiple valid edit list
 * representations that result in identical playback.
 *
 * Therefore:
 *
 *   - Edit lists are NOT derivable
 *   - Edit lists are NOT normalization
 *   - Edit lists are NOT adaptation
 *
 * Any compiler that emits an edit list MUST make an explicit policy decision.
 *
 * This file encodes that decision.
 *
 * ============================================================================
 * OBSERVED ORACLE BEHAVIOR (ffmpeg)
 * ============================================================================
 *
 * Inspection of ffmpeg-generated MP4 files for a single video track shows:
 *
 *   - An `edts` box IS present
 *   - It contains exactly ONE `elst` entry
 *   - elst.version = 0
 *   - elst.flags   = 0
 *
 * The single edit entry has the following properties:
 *
 *   editDuration:
 *     - expressed in MOVIE timescale units (mvhd.timescale)
 *     - numerically equals mvhd.duration
 *
 *   mediaTime:
 *     - expressed in TRACK timescale units (mdhd.timescale)
 *     - equals the first decodeable media timestamp
 *       (NOT always zero in general)
 *
 *   mediaRate:
 *     - integer  = 1
 *     - fraction = 0
 *
 * This represents normal (1.0×) playback with no rate adjustment.
 *
 * IMPORTANT:
 * ----------
 *
 * This structure deliberately mixes timescales:
 *
 *   - editDuration → movie timescale
 *   - mediaTime    → track timescale
 *
 * This is legal, intentional, and empirically confirmed.
 *
 * ============================================================================
 * WHAT THIS POLICY DOES
 * ============================================================================
 *
 * This policy encodes EXACTLY the behavior above.
 *
 * It:
 *   - emits a single-entry edit list
 *   - aligns track time to movie time
 *   - performs the required timescale conversion explicitly
 *
 * It does NOT:
 *   - infer trimming
 *   - infer gaps
 *   - infer looping
 *   - infer rate changes
 *   - attempt to generalize beyond the observed oracle
 *
 * ============================================================================
 * SCOPE AND CONSTRAINTS
 * ============================================================================
 *
 * This policy is valid ONLY when:
 *
 *   - exactly one track exists
 *   - no leading empty edit is required
 *   - no trimming or looping is modeled
 *   - playback rate is constant
 *
 * If ANY of these assumptions change, this policy MUST be replaced
 * with a more general edit list strategy.
 *
 * ============================================================================
 * ARCHITECTURAL CLASSIFICATION
 * ============================================================================
 *
 * This logic is:
 *
 *   - NOT normalization (multiple valid answers exist)
 *   - NOT derivation     (not implied by semantic facts)
 *   - NOT adaptation    (no shape translation)
 *
 * It IS:
 *
 *   - an explicit container policy
 *
 * ============================================================================
 * INPUTS
 * ============================================================================
 *
 * @param {Object} params
 *
 * @param {number} params.trackDuration
 *   Track duration in TRACK timescale units (mdhd.duration)
 *
 * @param {number} params.trackTimescale
 *   Track timescale (mdhd.timescale)
 *
 * @param {number} params.movieTimescale
 *   Movie timescale (mvhd.timescale)
 *
 * @param {number} params.mediaStartTime
 *   Media start time in TRACK timescale units.
 *   Empirically observed as the first access unit’s PTS.
 *
 * ============================================================================
 * OUTPUT
 * ============================================================================
 *
 * Returns parameters suitable for:
 *
 *   emitEdtsBox({
 *     elst: emitElstBox(...)
 *   })
 *
 * This function:
 *   - does NOT emit boxes
 *   - does NOT serialize bytes
 *   - does NOT apply layout
 *   - does NOT guess defaults
 *
 * It encodes a single, explicit, documented container decision.
 */
const OPUS_FRAME_SIZE = 960;

export function applyEditListPolicy({ track, mvhd }) {

    console.log("========================================");
    console.log("applyEditListPolicy BEGIN");
    console.log("trackId:", track.trackId);
    console.log("codec:", track.semanticCore?.codec?.codec);

    const codec = track.semanticCore?.codec?.codec;
    const codecProfile = requireCodecProfileByCodecName(
        codec,
        "applyEditListPolicy"
    );

    const trackTimescale = track.buildParameters.trackTimescale;
    const movieTimescale = mvhd.timescale;

    const trackDecodedDuration = track.trackDuration;

    const encoderDelaySamples =
        track.semanticHints?.encoderDelaySamples ?? 0;

    const encoderDelayRemainder =
        track.semanticHints?.encoderDelayRemainderSamples ?? 0;

    const effectiveEncoderDelaySamples =
        encoderDelaySamples + encoderDelayRemainder;

    const inferredTailPaddingSamples =
        track.semanticHints?.inferredTailPaddingSamples ?? 0;

    const effectiveDecodedDuration =
        trackDecodedDuration + inferredTailPaddingSamples;

    const trimmedTrackDurationSamples =
        effectiveDecodedDuration - effectiveEncoderDelaySamples;

    // ---------------------------------------------------------
    // editDuration (movie timescale)
    // ---------------------------------------------------------
    const editDuration = mvhd.duration;

    // ---------------------------------------------------------
    // mediaTime
    // ---------------------------------------------------------
    let mediaTime;

    if (codecProfile.editListMediaTimeStrategy === "frame_quantized_encoder_delay") {

        // FFmpeg: frame-quantised encoder delay
        const encoderDelayFrames =
            Math.floor(encoderDelaySamples / OPUS_FRAME_SIZE);

        const encoderDelaySeconds =
            encoderDelayFrames * (OPUS_FRAME_SIZE / trackTimescale);

        const encoderDelayMovieUnits =
            Math.round(encoderDelaySeconds * movieTimescale);

        mediaTime =
            Math.round(
                encoderDelayMovieUnits
                * trackTimescale
                / movieTimescale
            );

        console.log("OPUS_FRAME_SIZE:", OPUS_FRAME_SIZE);
        console.log("encoderDelayFrames:", encoderDelayFrames);
        console.log("encoderDelaySeconds:", encoderDelaySeconds);
        console.log("encoderDelayMovieUnits:", encoderDelayMovieUnits);

    } else {

        // Spec-straight path (video, mp4a)
        mediaTime = effectiveEncoderDelaySamples;
    }

    console.log("trackTimescale:", trackTimescale);
    console.log("movieTimescale:", movieTimescale);
    console.log("trackDecodedDuration:", trackDecodedDuration);
    console.log("encoderDelaySamples:", encoderDelaySamples);
    console.log("encoderDelayRemainder:", encoderDelayRemainder);
    console.log("effectiveEncoderDelaySamples:", effectiveEncoderDelaySamples);
    console.log("inferredTailPaddingSamples:", inferredTailPaddingSamples);
    console.log("trimmedTrackDurationSamples:", trimmedTrackDurationSamples);
    console.log("editDuration:", editDuration);
    console.log("mediaTime:", mediaTime);
    console.log("========================================");

    return {
        elst: {
            version: 0,
            flags: 0,
            entries: [
                {
                    editDuration,
                    mediaTime,
                    mediaRateInteger: 1,
                    mediaRateFraction: 0
                }
            ]
        }
    };
}
