import {
    assertExists,
    assertEqual
} from "../assertions.js";

import {
    extractTrackBuildParametersFromMp4UsingZeroBasedTrackIndex
} from "../reference/extractTrackBuildParametersFromMp4UsingZeroBasedTrackIndex.js";

export async function
test_extractTrackBuildParametersFromMp4UsingZeroBasedTrackIndex_Audio() {

    const resp =
        await fetch("reference/reference_av.mp4");

    const mp4Bytes =
        new Uint8Array(await resp.arrayBuffer());

    const params =
        extractTrackBuildParametersFromMp4UsingZeroBasedTrackIndex({
            mp4Bytes,
            zeroBasedTrackIndex: 1
        });

    // ---------------------------------------------------------
    // Required field
    // ---------------------------------------------------------

    assertExists(
        "trackTimescale",
        params.trackTimescale
    );

    // ---------------------------------------------------------
    // Audio must NOT expose video-only fields
    // ---------------------------------------------------------

    assertEqual(
        "codedWidth is absent for audio",
        params.codedWidth,
        undefined
    );

    assertEqual(
        "codedHeight is absent for audio",
        params.codedHeight,
        undefined
    );
}
