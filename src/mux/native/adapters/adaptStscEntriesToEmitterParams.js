/**
 * Adapt semantic STSC entries into emitter parameters.
 *
 * Boundary:
 *   Semantic derivation → box emission
 *
 * This adapter exists to decouple:
 *   - chunk semantics
 *   - emitter input contracts
 */
const DEFAULT_STSC_LAYOUT = "collapsed"; // "expanded" | "collapsed"

/**
 * Adapt semantic STSC entries into emitter parameters.
 *
 * Policy:
 * - collapsed  → mp4a-style (single entry)
 * - expanded   → ffmpeg / opus oracle (one entry per chunk)
 */
export function adaptStscEntriesToEmitterParams({ stscEntries, chunks }) {

    if (!Array.isArray(stscEntries)) {
        throw new Error(
            "adaptStscEntriesToEmitterParams: stscEntries must be an array"
        );
    }

    if (DEFAULT_STSC_LAYOUT === "collapsed") {

        const out = { entries: [] };

        for (const e of stscEntries) {
            out.entries.push({
                firstChunk: e.firstChunk,
                samplesPerChunk: e.samplesPerChunk,
                sampleDescriptionIndex: e.sampleDescriptionIndex
            });
        }

        return out;
    }

    // ---------------------------------------------------------
    // EXPANDED (requires chunk count)
    // ---------------------------------------------------------

    if (!Array.isArray(chunks) || chunks.length === 0) {
        throw new Error(
            "adaptStscEntriesToEmitterParams: expanded STSC requires chunks"
        );
    }

    // Current invariant: single semantic pattern
    const base = stscEntries[0];

    const out = { entries: [] };

    const chunkCount = chunks.length;

    for (let chunkIndex = 1; chunkIndex <= chunkCount; chunkIndex++) {
        out.entries.push({
            firstChunk: chunkIndex,
            samplesPerChunk: base.samplesPerChunk,
            sampleDescriptionIndex: base.sampleDescriptionIndex
        });
    }

    return out;
}
export function applyEditListPolicynext({ track, mvhd }) {

    console.log("========================================");
    console.log("applyEditListPolicy BEGIN");
    console.log("trackId:", track.trackId);
    console.log("codec:", track.semanticCore?.codec?.codec);

    const trackTimescale = track.buildParameters.trackTimescale;

    const trackDecodedDuration = track.trackDuration;

    const encoderDelaySamples =
        track.semanticHints?.encoderDelaySamples ?? 0;

    const encoderDelayRemainder =
        track.semanticHints?.encoderDelayRemainderSamples ?? 0;

    const effectiveEncoderDelay =
        encoderDelaySamples + encoderDelayRemainder;

    const inferredTailPaddingSamples =
        track.semanticHints?.inferredTailPaddingSamples ?? 0;

    const effectiveDecodedDuration =
        trackDecodedDuration + inferredTailPaddingSamples;

    const trimmedTrackDuration =
        effectiveDecodedDuration - effectiveEncoderDelay;

    const editDuration =
        Math.round(
            trimmedTrackDuration
            * mvhd.timescale
            / trackTimescale
        );

    // IMPORTANT: ELST mediaTime is in TRACK timescale
    const mediaTime = effectiveEncoderDelay;

    console.log("trackDecodedDuration:", trackDecodedDuration);
    console.log("encoderDelaySamples:", encoderDelaySamples);
    console.log("encoderDelayRemainder:", encoderDelayRemainder);
    console.log("effectiveEncoderDelay:", effectiveEncoderDelay);
    console.log("trimmedTrackDuration:", trimmedTrackDuration);
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
