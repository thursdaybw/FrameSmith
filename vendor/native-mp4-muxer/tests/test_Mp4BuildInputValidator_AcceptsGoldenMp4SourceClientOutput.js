import {
    runGoldenMp4AVTestClient
} from "./clients/goldenMp4AVSourceClient.js";

import {
    validateMp4BuildInput
} from "../compiler/validation/validateMp4BuildInput.js";

export async function
test_Mp4BuildInputValidator_AcceptsGoldenMp4SourceClientOutput() {

    const resp =
        await fetch("reference/reference_av.mp4");

    const mp4Bytes =
        new Uint8Array(await resp.arrayBuffer());

    const mp4BuildInput =
        await runGoldenMp4AVTestClient({ mp4Bytes });

    // Act + Assert: must NOT throw
    validateMp4BuildInput(mp4BuildInput);
}
