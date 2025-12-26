import { adaptCttsFromSamples } from "../adapters/adaptCttsFromSamples.js";
import { emitCttsBox } from "../box-emitters/cttsBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { extractBoxByPathFromMp4 } from "./reference/BoxExtractor.js";
import { extractVideoSamplesFromMp4 } from "./reference/Mp4SampleExtractor.js";
import { assertEqualHex, assertEqual } from "./assertions.js";

import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

export async function testNativeMuxer_CttsAdapter_Conformance_ffmpeg() {

    console.log(
        "=== testNativeMuxer_CttsAdapter_Conformance_ffmpeg ==="
    );

    // ---------------------------------------------------------
    // Load golden MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Extract semantic samples (oracle)
    // ---------------------------------------------------------
    const samples = extractVideoSamplesFromMp4({
        mp4Bytes: mp4
    });

    // ---------------------------------------------------------
    // Adapt → emit
    // ---------------------------------------------------------
    const params = adaptCttsFromSamples({ samples });

    // debug
    const refParsed = getGoldenTruthBox.fromMp4(
        mp4,
        "moov/trak/mdia/minf/stbl/ctts"
    );

    const refFields = refParsed.readFields();

    console.log("=== CTTS ENTRY DIFF ===");

    console.log("Golden entries:");
    console.table(refFields.entries);

    console.log("Adapter entries:");
    console.table(params.entries);
    // end debug

    const outBytes = serializeBoxTree(
        emitCttsBox(params)
    );

    // ---------------------------------------------------------
    // Extract reference CTTS
    // ---------------------------------------------------------
    const refBytes = extractBoxByPathFromMp4(
        mp4,
        "moov/trak/mdia/minf/stbl/ctts"
    );

    for (let i = 0; i < refBytes.length; i++) {
        assertEqualHex(
            `ctts.byte[${i}]`,
            outBytes[i],
            refBytes[i]
        );
    }

    assertEqual(
        "ctts.size",
        outBytes.length,
        refBytes.length
    );

    console.log(
        "PASS: CTTS adapter + emitter reproduce ffmpeg output byte-for-byte"
    );
}
