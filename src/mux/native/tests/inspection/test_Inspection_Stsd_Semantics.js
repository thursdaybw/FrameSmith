import {
    extractBoxByPathFromMp4
} from "../reference/BoxExtractor.js";

import {
    readStsdFieldsFromRaw
} from "../../inspection/semantic/FieldReaders.js";

import { assertExists } from "../assertions.js";

export async function test_Inspection_Stsd_Semantics() {

    console.log("=== test_Inspection_Stsd_Semantic ===");

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    const stsdRaw =
        extractBoxByPathFromMp4(mp4Bytes, "moov/trak/mdia/minf/stbl/stsd");

    assertExists("stsd raw", stsdRaw);

    const fields = readStsdFieldsFromRaw(stsdRaw);

    // Minimal liveness assertions
    assertExists("stsd.fields", fields);
    assertExists("stsd.entryCount", fields.stsd.entryCount);
    assertExists("sampleEntry.type", fields.sampleEntry.type);
}
