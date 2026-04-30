import {
    assertExists,
    assertEqual
} from "../assertions.js";

import {
    extractTrackBuildParametersFromMp4UsingZeroBasedTrackIndex
} from "../reference/extractTrackBuildParametersFromMp4UsingZeroBasedTrackIndex.js";

export async function test_extractTrackBuildParametersFromMp4UsingZeroBasedTrackIndex_Video() {

    const resp =
        await fetch("reference/reference_av.mp4");

    const mp4Bytes =
        new Uint8Array(await resp.arrayBuffer());

    const params =
        extractTrackBuildParametersFromMp4UsingZeroBasedTrackIndex({
            mp4Bytes,
            zeroBasedTrackIndex: 0
        });

    // ---------------------------------------------------------
    // Required fields
    // ---------------------------------------------------------

    assertExists(
        "trackTimescale",
        params.trackTimescale
    );

    assertExists(
        "codedWidth",
        params.codedWidth
    );

    assertExists(
        "codedHeight",
        params.codedHeight
    );

    // ---------------------------------------------------------
    // Sanity checks
    // ---------------------------------------------------------

    assertEqual(
        "trackTimescale is integer",
        Number.isInteger(params.trackTimescale),
        true
    );

    assertEqual(
        "codedWidth is integer",
        Number.isInteger(params.codedWidth),
        true
    );

    assertEqual(
        "codedHeight is integer",
        Number.isInteger(params.codedHeight),
        true
    );
}
