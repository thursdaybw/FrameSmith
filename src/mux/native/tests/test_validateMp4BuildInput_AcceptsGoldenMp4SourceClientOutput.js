/**
 * Mp4BuildInput Grammar Acceptance Test
 * ====================================
 *
 * Asserts that the Golden MP4 source client emits a syntactically
 * valid Mp4BuildInput according to the CLOSED WORLD grammar
 * enforced by validateMp4BuildInput.
 *
 * This test:
 * - does NOT compile MP4
 * - does NOT normalize access units
 * - does NOT derive structure
 * - does NOT assert policy
 *
 * It validates grammar only.
 */

import {
    runGoldenMp4AVTestClient
} from "./clients/goldenMp4AVSourceClient.js";

import {
    validateMp4BuildInput
} from "../validateMp4BuildInput.js";

export async function test_validateMp4BuildInput_AcceptsGoldenMp4SourceClientOutput() {

    const resp =
        await fetch("reference/reference_av.mp4");

    const mp4Bytes =
        new Uint8Array(await resp.arrayBuffer());

    const mp4BuildInput =
        await runGoldenMp4AVTestClient({ mp4Bytes });

    // ---------------------------------------------------------
    // Grammar validation (must NOT throw)
    // ---------------------------------------------------------

    validateMp4BuildInput(mp4BuildInput);
}
