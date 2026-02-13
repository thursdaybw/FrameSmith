import { getGoldenTruthBox } from "../../tests/goldenTruthExtractors/index.js";

/**
 * extractTrackContainerMetadataFromMp4
 * =========================================================
 *
 * Boundary adapter.
 *
 * Extracts REQUIRED, NON-SEMANTIC track build parameters
 * from an MP4 container.
 *
 * This function:
 * - performs NO container policy
 * - performs NO semantic inference
 * - does NOT expose extractor internals
 * - does NOT use getEmitterInput
 *
 * Returned values are suitable ONLY for compiler input.
 *
 * @param {Object} params
 * @param {Uint8Array} params.mp4Bytes
 * @param {number} params.zeroBasedTrackIndex
 *
 * @returns {Object}
 *   {
 *     trackTimescale: number,
 *     codedWidth?: number,
 *     codedHeight?: number
 *   }
 */
export function
extractTrackContainerMetadataFromMp4({
    mp4Bytes,
    zeroBasedTrackIndex
}) {

    // ---------------------------------------------------------
    // Validation (boundary hygiene)
    // ---------------------------------------------------------

    if (!(mp4Bytes instanceof Uint8Array)) {
        throw new Error(
            "extractTrackBuildParametersFromMp4UsingZeroBasedTrackIndex: mp4Bytes must be Uint8Array"
        );
    }

    if (!Number.isInteger(zeroBasedTrackIndex) || zeroBasedTrackIndex < 0) {
        throw new Error(
            "extractTrackBuildParametersFromMp4UsingZeroBasedTrackIndex: zeroBasedTrackIndex must be >= 0"
        );
    }

    // ---------------------------------------------------------
    // mdhd — track timescale (required for all tracks)
    // ---------------------------------------------------------

    const mdhdReport =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4Bytes,
                `moov/trak[${zeroBasedTrackIndex}]/mdia/mdhd`
            )
            .readBoxReport();

    const trackTimescale =
        mdhdReport?.box?.fields?.timescale;

    if (!Number.isInteger(trackTimescale) || trackTimescale <= 0) {
        throw new Error(
            "extractTrackBuildParametersFromMp4UsingZeroBasedTrackIndex: mdhd.timescale missing, non-integer, or non-positive"
        );
    }

    // ---------------------------------------------------------
    // tkhd — coded dimensions (video-only)
    // ---------------------------------------------------------

    const tkhdReport =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4Bytes,
                `moov/trak[${zeroBasedTrackIndex}]/tkhd`
            )
            .readBoxReport();

    const rawWidth  = tkhdReport?.box?.fields?.width;
    const rawHeight = tkhdReport?.box?.fields?.height;
    const width  = Number.isInteger(rawWidth)  ? rawWidth  >> 16 : undefined;
    const height = Number.isInteger(rawHeight) ? rawHeight >> 16 : undefined;

    // ---------------------------------------------------------
    // Assemble result
    // ---------------------------------------------------------

    const result = {
        trackTimescale
    };

    // Video tracks expose coded dimensions.
    // Audio tracks MUST NOT invent them.
    if (
        Number.isInteger(width) &&
        Number.isInteger(height) &&
        width  > 0 &&
        height > 0
    ) {
        result.codedWidth  = width;
        result.codedHeight = height;
    }

    return result;
}
