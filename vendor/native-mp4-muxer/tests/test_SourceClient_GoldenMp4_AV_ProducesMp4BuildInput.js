/**
 * Golden MP4 (Audio + Video) → Mp4BuildInput Definition Test
 *
 * CONTRACT ENCODING
 * =================
 *
 * This test asserts the executable Mp4BuildInput contract
 * for the Golden MP4 Audio+Video source client.
 *
 * Interpretation rules:
 *
 *   - Any field ASSERTED here is REQUIRED.
 *   - Any field PRESENT but NOT asserted is OPTIONAL.
 *   - Any field NOT PRESENT is OUT OF CONTRACT.
 *
 * This test:
 *   - validates structural shape only
 *   - does NOT compile MP4
 *   - does NOT assert container policy
 *   - does NOT assert byte equivalence
 *
 * This test MUST remain isomorphic with:
 *   test_SourceClient_WebCodecs_AV_ProducesMp4BuildInput
 */

import {
    assertExists,
    assertEqual
} from "./assertions.js";

import {
    runGoldenMp4AVTestClient
} from "./clients/goldenMp4AVSourceClient.js";

export async function test_SourceClient_GoldenMp4_AV_ProducesMp4BuildInput() {

    const resp =
        await fetch("reference/reference_av.mp4");

    const mp4Bytes =
        new Uint8Array(await resp.arrayBuffer());

    const result =
        await runGoldenMp4AVTestClient({ mp4Bytes });

    // ---------------------------------------------------------
    // TOP-LEVEL SHAPE
    // ---------------------------------------------------------

    assertExists("result.tracks", result.tracks);

    assertEqual(
        "tracks is array",
        Array.isArray(result.tracks),
        true
    );

    assertEqual(
        "two tracks present",
        result.tracks.length >= 2,
        true
    );

    // ---------------------------------------------------------
    // VIDEO TRACK (trak[0])
    // ---------------------------------------------------------

    const videoTrack = result.tracks[0];

    assertExists("video.semanticCore", videoTrack.semanticCore);
    assertExists("video.payloads", videoTrack.payloads);
    assertExists("video.buildParameters", videoTrack.buildParameters);

    // -----------------------------
    // Video access units
    // -----------------------------

    const videoAccessUnits =
        videoTrack.semanticCore.accessUnits;

    const videoPayloads =
        videoTrack.payloads.accessUnitPayloads;

    assertEqual(
        "video accessUnits is array",
        Array.isArray(videoAccessUnits),
        true
    );

    assertEqual(
        "video payloads is array",
        Array.isArray(videoPayloads),
        true
    );

    assertEqual(
        "video payload count matches access unit count",
        videoPayloads.length,
        videoAccessUnits.length
    );

    const firstVideoUnit = videoAccessUnits[0];

    assertExists("video.accessUnit.pts", firstVideoUnit.pts);
    assertExists("video.accessUnit.isKey", firstVideoUnit.isKey);

    // -----------------------------
    // Video codec core
    // -----------------------------

    assertExists(
        "video.codec.codec",
        videoTrack.semanticCore.codec.codec
    );

    assertEqual(
        "video codec is avc1",
        videoTrack.semanticCore.codec.codec,
        "avc1"
    );

    assertExists(
        "video.codec.avcC",
        videoTrack.semanticCore.codec.avcC
    );

    // -----------------------------
    // Video build parameters
    // -----------------------------

    assertExists(
        "video.buildParameters.codedWidth",
        videoTrack.buildParameters.codedWidth
    );

    assertExists(
        "video.buildParameters.codedHeight",
        videoTrack.buildParameters.codedHeight
    );

    assertExists(
        "video.buildParameters.trackTimescale",
        videoTrack.buildParameters.trackTimescale
    );

    // ---------------------------------------------------------
    // AUDIO TRACK (trak[1])
    // ---------------------------------------------------------

    const audioTrack = result.tracks[1];

    assertExists("audio.semanticCore", audioTrack.semanticCore);
    assertExists("audio.payloads", audioTrack.payloads);
    assertExists("audio.buildParameters", audioTrack.buildParameters);

    // -----------------------------
    // Audio access units
    // -----------------------------

    const audioAccessUnits =
        audioTrack.semanticCore.accessUnits;

    const audioPayloads =
        audioTrack.payloads.accessUnitPayloads;

    assertEqual(
        "audio accessUnits is array",
        Array.isArray(audioAccessUnits),
        true
    );

    assertEqual(
        "audio payloads is array",
        Array.isArray(audioPayloads),
        true
    );

    assertEqual(
        "audio payload count matches access unit count",
        audioPayloads.length,
        audioAccessUnits.length
    );

    const firstAudioUnit = audioAccessUnits[0];

    assertExists("audio.accessUnit.pts", firstAudioUnit.pts);
    assertExists("audio.accessUnit.isKey", firstAudioUnit.isKey);

    // -----------------------------
    // Audio codec core
    // -----------------------------

    assertExists(
        "audio.codec.codec",
        audioTrack.semanticCore.codec.codec
    );

    assertEqual(
        "audio codec is mp4a",
        audioTrack.semanticCore.codec.codec,
        "mp4a"
    );

    assertExists(
        "audio.codec.esds",
        audioTrack.semanticCore.codec.esds
    );

    // -----------------------------
    // Audio build parameters
    // -----------------------------

    assertExists(
        "audio.buildParameters.trackTimescale",
        audioTrack.buildParameters.trackTimescale
    );

    assertEqual(
        "audio has no codedWidth",
        audioTrack.buildParameters.codedWidth,
        undefined
    );

    assertEqual(
        "audio has no codedHeight",
        audioTrack.buildParameters.codedHeight,
        undefined
    );
}
