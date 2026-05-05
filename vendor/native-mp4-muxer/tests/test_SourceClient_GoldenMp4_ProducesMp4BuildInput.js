/**
 * Golden MP4 → Mp4BuildInput Definition Test
 *
 * CONTRACT ENCODING
 * =================
 *
 * This test encodes the Mp4BuildInput contract as executable truth
 * for a Golden MP4 TEST CLIENT.
 *
 * Interpretation rules:
 *
 *   - Any field ASSERTED here is REQUIRED.
 *   - Any field PRESENT in the client output but NOT asserted
 *     is OPTIONAL.
 *   - Any field NOT PRESENT at all is OUT OF CONTRACT.
 *
 * Architectural consequences:
 *
 *   - Golden MP4 extraction is treated as a TEST CLIENT
 *   - No container policy is implied
 *   - No defaults are permitted
 *   - No inference beyond extractable facts is permitted
 *
 * This test MUST remain isomorphic with:
 *   test_SourceClient_WebCodecs_ProducesMp4BuildInput
 *
 * Changing this test changes the Mp4BuildInput contract.
 *
 * Diagnostic rule:
 * ----------------
 * Assertions are ordered from MOST specific to MOST general.
 * Leaf failures must surface before structural failures.
 */

import {
    assertExists,
    assertEqual
} from "./assertions.js";

import {
    runGoldenMp4TestClient
} from "./clients/goldenMp4SourceClient.js";

export async function test_SourceClient_GoldenMp4_ProducesMp4BuildInput() {

    const resp = await fetch("reference/reference_visual.mp4");
    const goldenMp4 = new Uint8Array(await resp.arrayBuffer());

    const mp4BuildInput =
        await runGoldenMp4TestClient({
            mp4Bytes: goldenMp4
        });

    // ---------------------------------------------------------
    // ACCESS UNIT PAYLOADS (opaque bytes, positional)
    // ---------------------------------------------------------

    assertExists(
        "payloads.accessUnitPayloads",
        mp4BuildInput?.payloads?.accessUnitPayloads
    );

    assertEqual(
        "payloads.accessUnitPayloads is array",
        Array.isArray(mp4BuildInput.payloads.accessUnitPayloads),
        true
    );

    assertEqual(
        "payload count matches access unit count",
        mp4BuildInput.payloads.accessUnitPayloads.length,
        mp4BuildInput.semanticCore.accessUnits.length
    );

    // ---------------------------------------------------------
    // LEAF ASSERTIONS — access units
    // ---------------------------------------------------------

    const firstUnit =
        mp4BuildInput.semanticCore.accessUnits[0];

    assertExists("accessUnit.pts", firstUnit.pts);
    assertExists("accessUnit.isKey", firstUnit.isKey);

    // ---------------------------------------------------------
    // CODEC CORE
    // ---------------------------------------------------------

    assertEqual(
        "codec.avcCCompleteness === container-complete",
        mp4BuildInput.semanticCore.codec.avcCCompleteness,
        "container-complete"
    );

    // ---------------------------------------------------------
    // BUILD PARAMETERS
    // ---------------------------------------------------------

    assertExists(
        "buildParameters.codedWidth",
        mp4BuildInput.buildParameters.codedWidth
    );

    assertExists(
        "buildParameters.codedHeight",
        mp4BuildInput.buildParameters.codedHeight
    );

    assertExists(
        "buildParameters.trackTimescale",
        mp4BuildInput.buildParameters.trackTimescale
    );

    // ---------------------------------------------------------
    // BUILD HINTS — UDTA (opaque historical passthrough)
    // ---------------------------------------------------------

    assertExists(
        "buildHints.udtaBytes",
        mp4BuildInput.buildHints?.udtaBytes
    );

    assertEqual(
        "buildHints.udtaBytes is Uint8Array",
        mp4BuildInput.buildHints.udtaBytes instanceof Uint8Array,
        true
    );

    // Golden MP4 client MUST NOT emit semantic identity
    assertEqual(
        "buildHints.encoderIdentity is absent",
        "encoderIdentity" in mp4BuildInput.buildHints,
        false
    );

    // ---------------------------------------------------------
    // TOP-LEVEL ASSERTION
    // ---------------------------------------------------------

    assertExists("mp4BuildInput", mp4BuildInput);

}
