/**
 * WebCodecs → Mp4BuildInput Definition Test
 *
 * CONTRACT ENCODING
 * =================
 *
 * This test encodes the Mp4BuildInput contract as executable truth
 * for a WebCodecs TEST CLIENT.
 *
 * Architectural consequences:
 *
 *   - semanticCore contains encoder-emitted facts only
 *   - payloads contain opaque access unit bytes
 *   - buildParameters are application-owned
 *   - no container history is available
 *   - no policy is implied
 *
 * Changing this test changes the Mp4BuildInput contract.
 */

import {
    assertExists,
    assertEqual
} from "./assertions.js";

import {
    runWebCodecsTestClient
} from "./clients/webcodecsReferenceSourceClient.js";

export async function test_SourceClient_WebCodecs_ProducesMp4BuildInput() {

    const mp4BuildInput = await runWebCodecsTestClient();

    // ---------------------------------------------------------
    // ACCESS UNIT PAYLOADS
    // ---------------------------------------------------------

    assertExists(
        "payloads.accessUnitPayloads",
        mp4BuildInput.payloads.accessUnitPayloads
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
        "codec.avcCCompleteness === semantic",
        mp4BuildInput.semanticCore.codec.avcCCompleteness,
        "semantic"
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
    // BUILD HINTS — UDTA (must be absent)
    // ---------------------------------------------------------

    assertEqual(
        "buildHints.udtaBytes is absent",
        mp4BuildInput.buildHints?.udtaBytes !== undefined,
        false
    );

    // encoderIdentity MAY be present (application-owned)
    // Presence is OPTIONAL, not asserted here

    // ---------------------------------------------------------
    // TOP-LEVEL ASSERTION
    // ---------------------------------------------------------

    assertExists("mp4BuildInput", mp4BuildInput);


    if (window.DEBUG_DOWNLOAD_MP4 === true) {

        const mp4CompilerState =
            await createMp4CompilerStateFromBuildInput(mp4BuildInput);

        const { bytes } =
            compileMp4({ mp4CompilerState });

        downloadMp4(bytes, "webcodecs-native.mp4");
    }

    console.log(
        "PASS: WebCodecs test client produces valid Mp4BuildInput"
    );
}

function downloadMp4(bytes, filename) {
    const blob = new Blob([bytes], { type: "video/mp4" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
