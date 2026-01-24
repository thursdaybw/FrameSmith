/**
 * validateCompilerAdmissibility
 * =============================
 *
 * Compiler admissibility gate.
 *
 * PURPOSE
 * -------
 * Determines whether a syntactically-valid Mp4BuildInput is
 * *legal to compile* under the current NativeMuxer constraints.
 *
 * This is NOT grammar validation.
 * This is NOT normalization.
 * This is NOT policy.
 *
 * This function exists to fail early, loudly, and deterministically
 * when required values are missing, malformed, or incompatible with
 * the compiler’s current capabilities.
 *
 * If this function passes:
 *   - compileMp4 may assume all required values are present
 *   - compileMp4 may assume values are in correct units
 *   - no defensive validation is required downstream
 *
 * If this function fails:
 *   - compilation MUST NOT proceed
 *
 * DESIGN RULES
 * ------------
 * - No mutation
 * - No defaults
 * - No coercion
 * - No container knowledge
 * - No fixing of caller mistakes
 */

export function validateCompilerAdmissibility(mp4BuildInput) {

    const tracks = mp4BuildInput.tracks;

    if (!Array.isArray(tracks) || tracks.length === 0) {
        throw new Error(
            "validateCompilerAdmissibility: at least one track is required"
        );
    }

    tracks.forEach((track, index) => {
        validateTrackAdmissibility(track, index);
    });
}

function validateTrackAdmissibility(track, trackIndex) {

    const { semanticCore, buildParameters } = track;

    if (!semanticCore || !semanticCore.codec) {
        throw new Error(
            `Track[${trackIndex}]: semanticCore.codec is required`
        );
    }

    const codecString = semanticCore.codec.codec;

    if (typeof codecString !== "string") {
        throw new Error(
            `Track[${trackIndex}]: codec.codec must be a string`
        );
    }

    if (!buildParameters || typeof buildParameters !== "object") {
        throw new Error(
            `Track[${trackIndex}]: buildParameters are required`
        );
    }

    // ---------------------------------------------------------
    // Track timescale (required for ALL tracks)
    // ---------------------------------------------------------

    const { trackTimescale } = buildParameters;

    if (
        !Number.isInteger(trackTimescale) ||
        trackTimescale <= 0
    ) {
        throw new Error(
            `Track[${trackIndex}]: buildParameters.trackTimescale must be a positive integer`
        );
    }

    // ---------------------------------------------------------
    // Video tracks (avc1*)
    // ---------------------------------------------------------

    if (codecString.startsWith("avc1")) {

        const { codedWidth, codedHeight } = buildParameters;

        if (
            !Number.isInteger(codedWidth) ||
            codedWidth <= 0
        ) {
            throw new Error(
                `Track[${trackIndex}]: video codedWidth must be a positive integer (got ${codedWidth})`
            );
        }

        if (
            !Number.isInteger(codedHeight) ||
            codedHeight <= 0
        ) {
            throw new Error(
                `Track[${trackIndex}]: video codedHeight must be a positive integer (got ${codedHeight})`
            );
        }

        // Reject 16.16 fixed-point values (container leakage)
        if (codedWidth > 0xFFFF || codedHeight > 0xFFFF) {
            throw new Error(
                `Track[${trackIndex}]: codedWidth/codedHeight appear to be fixed-point values ` +
                `(got ${codedWidth}x${codedHeight}). ` +
                `buildParameters must be pixel dimensions, not container-encoded fields.`
            );
        }

        return;
    }




    // ---------------------------------------------------------
    // Audio tracks (mp4a / opus)
    // ---------------------------------------------------------

    if (
        codecString === "opus" ||
        codecString.startsWith("mp4a")
    ) {

        const { channelCount, sampleRate } = buildParameters;

        if (
            !Number.isInteger(channelCount) ||
            channelCount <= 0
        ) {
            throw new Error(
                `Track[${trackIndex}]: audio channelCount must be a positive integer`
            );
        }

        if (
            !Number.isInteger(sampleRate) ||
            sampleRate <= 0
        ) {
            throw new Error(
                `Track[${trackIndex}]: audio sampleRate must be a positive integer`
            );
        }

        return;
    }

    // ---------------------------------------------------------
    // Unsupported codec
    // ---------------------------------------------------------

    throw new Error(
        `Track[${trackIndex}]: unsupported codec for compilation: ${codecString}`
    );
}
