export function applyAudioDurationPolicy({ codecName, rawSampleDuration, semanticHints }) {
    // Only AAC (mp4a) has implicit encoder trimming semantics
    if (codecName === "mp4a") {

        // Highest authority: oracle-supplied media duration
        if (Number.isInteger(semanticHints?.inputTrackDurationInTrackTimescale)) {
            return semanticHints.inputTrackDurationInTrackTimescale;
        }

        // Secondary authority: explicit encoder delay / padding (if ever supplied)
        const encoderDelay  = semanticHints?.encoderDelaySamples ?? 0;
        const paddingSamples = semanticHints?.paddingSamples ?? 0;

        return rawSampleDuration - encoderDelay - paddingSamples;
    }

    // All other codecs: duration is purely derivable
    return rawSampleDuration;
}
