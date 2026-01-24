import {
    assertExists,
    assertEqual
} from "./assertions.js";

import {
    extractTrackCodecConfigurationFromMp4UsingZeroBasedTrackIndex
} from "./reference/extractTrackCodecConfigurationFromMp4UsingZeroBasedTrackIndex.js";

export async function
test_extractTrackCodecConfigurationFromMp4UsingZeroBasedTrackIndex_Video() {

    const resp =
        await fetch("reference/reference_av.mp4");

    const mp4Bytes =
        new Uint8Array(await resp.arrayBuffer());

    const codecConfig =
        extractTrackCodecConfigurationFromMp4UsingZeroBasedTrackIndex({
            mp4Bytes,
            zeroBasedTrackIndex: 0
        });

    // ---------------------------------------------------------
    // Required shape
    // ---------------------------------------------------------

    assertExists("video.codecConfig", codecConfig);

    assertExists(
        "video.codecConfig.codec",
        codecConfig.codec
    );

    assertEqual(
        "video codec is avc1",
        codecConfig.codec,
        "avc1"
    );

    // ---------------------------------------------------------
    // AVC-specific requirements
    // ---------------------------------------------------------

    assertExists(
        "video.codecConfig.avcC",
        codecConfig.avcC
    );

    assertExists(
        "video.codecConfig.avcCCompleteness",
        codecConfig.avcCCompleteness
    );

    assertEqual(
        "avcCCompleteness is container-complete",
        codecConfig.avcCCompleteness,
        "container-complete"
    );

    // ---------------------------------------------------------
    // Forbidden fields (definition discipline)
    // ---------------------------------------------------------

    assertEqual(
        "video codec has no esds",
        codecConfig.esds,
        undefined
    );
}


export async function
test_extractTrackCodecConfigurationFromMp4UsingZeroBasedTrackIndex_Audio() {

    const resp =
        await fetch("reference/reference_av.mp4");

    const mp4Bytes =
        new Uint8Array(await resp.arrayBuffer());

    const codecConfig =
        extractTrackCodecConfigurationFromMp4UsingZeroBasedTrackIndex({
            mp4Bytes,
            zeroBasedTrackIndex: 1
        });

    // ---------------------------------------------------------
    // Required shape
    // ---------------------------------------------------------

    assertExists("audio.codecConfig", codecConfig);

    assertExists(
        "audio.codecConfig.codec",
        codecConfig.codec
    );

    assertEqual(
        "audio codec is mp4a",
        codecConfig.codec,
        "mp4a"
    );

    // ---------------------------------------------------------
    // MP4A-specific requirements
    // ---------------------------------------------------------

    assertExists(
        "audio.codecConfig.esds",
        codecConfig.esds
    );

    // ---------------------------------------------------------
    // Forbidden fields (definition discipline)
    // ---------------------------------------------------------

    assertEqual(
        "audio codec has no avcC",
        codecConfig.avcC,
        undefined
    );

    assertEqual(
        "audio codec has no avcCCompleteness",
        codecConfig.avcCCompleteness,
        undefined
    );
}

export async function test_extractTrackCodecConfigurationFromMp4UsingZeroBasedTrackIndex_InvalidTrackIndexThrows() {

    const resp =
        await fetch("reference/reference_av.mp4");

    const mp4Bytes =
        new Uint8Array(await resp.arrayBuffer());

    let threw = false;

    try {
        extractTrackCodecConfigurationFromMp4UsingZeroBasedTrackIndex({
            mp4Bytes,
            zeroBasedTrackIndex: 99
        });
    } catch (e) {
        threw = true;
    }

    assertEqual(
        "invalid track index throws",
        threw,
        true
    );
}
