/**
 * WebCodecs (Audio+Video) → TrackInput Definition Test
 *
 * CONTRACT ENCODING
 * =================
 *
 * This test asserts the executable contract for the
 * WebCodecs Audio+Video source client.
 *
 * It validates:
 *   - top-level shape: { tracks, containerHints }
 *   - one video track is present
 *   - track-local Mp4BuildInput semantics are respected
 *
 * This test does NOT compile MP4.
 * This test does NOT assert container policy.
 */

import {
    assertExists,
    assertEqual
} from "./assertions.js";

import {
    runWebCodecsAudioVideoTestClient
} from "./clients/webcodecsReferenceAudioVideoSourceClient.js";

export async function test_SourceClient_WebCodecs_AV_ProducesMp4BuildInputInput() {

    const result =
        await runWebCodecsAudioVideoTestClient();

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
        "at least one track present",
        result.tracks.length >= 1,
        true
    );

    // containerHints is OPTIONAL
    // Presence is not required here

    // ---------------------------------------------------------
    // VIDEO TRACK (first track)
    // ---------------------------------------------------------

    const videoTrack = result.tracks[0];

    assertExists("track.semanticCore", videoTrack.semanticCore);
    assertExists("track.payloads", videoTrack.payloads);
    assertExists("track.buildParameters", videoTrack.buildParameters);

    // ---------------------------------------------------------
    // ACCESS UNITS
    // ---------------------------------------------------------

    const accessUnits =
        videoTrack.semanticCore.accessUnits;

    const payloads =
        videoTrack.payloads.accessUnitPayloads;

    assertEqual(
        "accessUnits is array",
        Array.isArray(accessUnits),
        true
    );

    assertEqual(
        "payloads is array",
        Array.isArray(payloads),
        true
    );

    assertEqual(
        "payload count matches access unit count",
        payloads.length,
        accessUnits.length
    );

    const firstUnit = accessUnits[0];

    assertExists("accessUnit.pts", firstUnit.pts);
    assertExists("accessUnit.isKey", firstUnit.isKey);

    // ---------------------------------------------------------
    // CODEC CORE (video)
    // ---------------------------------------------------------

    assertExists(
        "codec.codec",
        videoTrack.semanticCore.codec.codec
    );

    assertEqual(
        "codec.avcCCompleteness === semantic",
        videoTrack.semanticCore.codec.avcCCompleteness,
        "semantic"
    );

    // ---------------------------------------------------------
    // BUILD PARAMETERS
    // ---------------------------------------------------------

    assertExists(
        "buildParameters.codedWidth",
        videoTrack.buildParameters.codedWidth
    );

    assertExists(
        "buildParameters.codedHeight",
        videoTrack.buildParameters.codedHeight
    );

    assertExists(
        "buildParameters.trackTimescale",
        videoTrack.buildParameters.trackTimescale
    );

    // ---------------------------------------------------------
    // AUDIO TRACK (second track)
    // ---------------------------------------------------------

    assertEqual(
        "audio track present",
        result.tracks.length >= 2,
        true
    );

    const audioTrack = result.tracks[1];

    assertExists("audio.track.semanticCore", audioTrack.semanticCore);
    assertExists("audio.track.payloads", audioTrack.payloads);
    assertExists("audio.track.buildParameters", audioTrack.buildParameters);

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

    // ---------------------------------------------------------
    // CODEC CORE (audio)
    // ---------------------------------------------------------

    assertExists(
        "audio.codec.codec",
        audioTrack.semanticCore.codec.codec
    );

    // Audio must NOT declare video-only fields
    assertEqual(
        "audio has no avcC",
        audioTrack.semanticCore.codec.avcC,
        undefined
    );

    // ---------------------------------------------------------
    // BUILD PARAMETERS (audio)
    // ---------------------------------------------------------

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
