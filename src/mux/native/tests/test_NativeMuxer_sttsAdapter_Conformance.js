import { extractVideoSamplesFromMp4 } from "./reference/Mp4SampleExtractor.js";
import { adaptSttsFromSamples } from "../adapters/adaptSttsFromSamples.js";
import { emitSttsBox } from "../box-emitters/sttsBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { extractBoxByPathFromMp4 } from "./reference/BoxExtractor.js";
import { assertEqualHex, assertEqual } from "./assertions.js";

export async function testNativeMuxer_SttsAdapter_Conformance_ffmpeg() {

    console.log(
        "=== testNativeMuxer_SttsAdapter_Conformance_ffmpeg ==="
    );

    // ---------------------------------------------------------
    // 1. Load golden MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Extract semantic samples (reference-only)
    // ---------------------------------------------------------
    const samples = extractVideoSamplesFromMp4({
        mp4Bytes: mp4
    });

    // ---------------------------------------------------------
    // 3. Adapt semantic samples → emitter input
    // ---------------------------------------------------------
    const sttsParams = adaptSttsFromSamples({ samples });

    // ---------------------------------------------------------
    // 4. Emit STTS box
    // ---------------------------------------------------------
    const outBytes = serializeBoxTree(
        emitSttsBox(sttsParams)
    );

    // ---------------------------------------------------------
    // 5. Extract reference STTS bytes
    // ---------------------------------------------------------
    const refBytes = extractBoxByPathFromMp4(
        mp4,
        "moov/trak/mdia/minf/stbl/stts"
    );

    // ---------------------------------------------------------
    // 6. Byte-for-byte equivalence
    // ---------------------------------------------------------
    assertEqual(
        "stts.size",
        outBytes.length,
        refBytes.length
    );

    for (let i = 0; i < refBytes.length; i++) {
        assertEqualHex(
            `stts.byte[${i}]`,
            outBytes[i],
            refBytes[i]
        );
    }

    console.log(
        "PASS: STTS adapter + emitter reproduce ffmpeg output byte-for-byte"
    );
}
