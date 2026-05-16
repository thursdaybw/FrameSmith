import { getGoldenTruthBox }
    from "../goldenTruthExtractors/index.js";

/**
 * extractMovieTimingHintsFromMp4
 * ==============================
 *
 * Boundary adapter.
 *
 * Extracts movie-level timing hints from an MP4 container.
 *
 * Currently exposes:
 * - movieTimescale
 *
 * This function:
 * - performs NO container policy
 * - performs NO semantic inference
 * - does NOT expose extractor internals
 *
 * @param {Object} params
 * @param {Uint8Array} params.mp4Bytes
 *
 * @returns {Object}
 *   {
 *     movieTimescale: number
 *   }
 */
export function
extractMovieTimingHintsFromMp4({
    mp4Bytes
}) {

    if (!(mp4Bytes instanceof Uint8Array)) {
        throw new Error(
            "extractMovieTimingHintsFromMp4: mp4Bytes must be Uint8Array"
        );
    }

    const report =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4Bytes,
                "moov/mvhd"
            )
            .readBoxReport();

    const movieTimescale = report?.box?.fields?.timescale;
    const movieDuration = report?.box?.fields?.duration;

    if (!Number.isInteger(movieTimescale)) {
        throw new Error(
            "extractMovieTimingHintsFromMp4: mvhd.timescale missing or invalid"
        );
    }

    return {
        movieTimescale,
        movieDuration 
    };
}
