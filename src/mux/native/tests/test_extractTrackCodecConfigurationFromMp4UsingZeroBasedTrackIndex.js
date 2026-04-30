import { assertExists, assertEqual } from "./assertions.js";

import { extractTrackCodecConfigurationFromMp4 } from "../demux/container/extractTrackCodecConfigurationFromMp4.js";

export async function test_extractTrackCodecConfigurationFromMp4UsingZeroBasedTrackIndex_Video() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    const codecConfig = extractTrackCodecConfigurationFromMp4({
        mp4Bytes,
        zeroBasedTrackIndex: 0
    });

    // ---------------------------------------------------------
    // Required shape
    // ---------------------------------------------------------

    assertExists("video.codecConfig", codecConfig);
    assertExists("video.codecConfig.codec", codecConfig.codec);
    assertExists("video.codecConfig.config", codecConfig.config);

    assertEqual("video codec is avc1", codecConfig.codec, "avc1");

    assertEqual(
        "video config representation is container",
        codecConfig.config.representation,
        "container"
    );

    assertEqual(
        "video config bytes is Uint8Array",
        codecConfig.config.bytes instanceof Uint8Array,
        true
    );

    assertEqual(
        "video config bytes non-empty",
        codecConfig.config.bytes.length > 0,
        true
    );

    // ---------------------------------------------------------
    // Legacy fields must not exist
    // ---------------------------------------------------------

    assertEqual("video codec has no avcC", codecConfig.avcC, undefined);
    assertEqual("video codec has no esds", codecConfig.esds, undefined);
    assertEqual("video codec has no hvcC", codecConfig.hvcC, undefined);
}


export async function test_extractTrackCodecConfigurationFromMp4UsingZeroBasedTrackIndex_Audio() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    const codecConfig = extractTrackCodecConfigurationFromMp4({
        mp4Bytes,
        zeroBasedTrackIndex: 1
    });

    // ---------------------------------------------------------
    // Required shape
    // ---------------------------------------------------------

    assertExists("audio.codecConfig", codecConfig);
    assertExists("audio.codecConfig.codec", codecConfig.codec);
    assertExists("audio.codecConfig.config", codecConfig.config);

    assertEqual("audio codec is mp4a", codecConfig.codec, "mp4a");

    assertEqual(
        "audio config representation is container",
        codecConfig.config.representation,
        "container"
    );

    assertEqual(
        "audio config bytes is Uint8Array",
        codecConfig.config.bytes instanceof Uint8Array,
        true
    );

    assertEqual(
        "audio config bytes non-empty",
        codecConfig.config.bytes.length > 0,
        true
    );

    // ---------------------------------------------------------
    // Legacy fields must not exist
    // ---------------------------------------------------------

    assertEqual("audio codec has no avcC", codecConfig.avcC, undefined);
    assertEqual("audio codec has no esds", codecConfig.esds, undefined);
    assertEqual("audio codec has no hvcC", codecConfig.hvcC, undefined);
}


export async function test_extractTrackCodecConfigurationFromMp4UsingZeroBasedTrackIndex_InvalidTrackIndexThrows() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    let threw = false;

    try {
        extractTrackCodecConfigurationFromMp4({
            mp4Bytes,
            zeroBasedTrackIndex: 99
        });
    } catch (e) {
        threw = true;
    }

    assertEqual("invalid track index throws", threw, true);
}
