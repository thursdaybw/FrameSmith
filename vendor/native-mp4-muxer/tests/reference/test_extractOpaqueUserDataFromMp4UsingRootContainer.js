import {
    assertExists
} from "../assertions.js";

import {
    extractOpaqueUserDataFromMp4UsingRootContainer
} from "../reference/extractOpaqueUserDataFromMp4UsingRootContainer.js";

export async function
test_extractOpaqueUserDataFromMp4UsingRootContainer() {

    const resp =
        await fetch("reference/reference_av.mp4");

    const mp4Bytes =
        new Uint8Array(await resp.arrayBuffer());

    const udtaBytes =
        extractOpaqueUserDataFromMp4UsingRootContainer({
            mp4Bytes
        });

    // ---------------------------------------------------------
    // Contract
    // ---------------------------------------------------------

    assertExists(
        "udtaBytes returned",
        udtaBytes
    );

    if (!(udtaBytes instanceof Uint8Array)) {
        throw new Error(
            "udtaBytes must be Uint8Array"
        );
    }
}
