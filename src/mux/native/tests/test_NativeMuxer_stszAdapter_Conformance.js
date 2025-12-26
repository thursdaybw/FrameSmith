import { adaptStszFromSamples } from "../adapters/adaptStszFromSamples.js";
import { emitStszBox } from "../box-emitters/stszBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { extractBoxByPathFromMp4 } from "./reference/BoxExtractor.js";
import { extractVideoSamplesFromMp4 } from "./reference/Mp4SampleExtractor.js";
import { assertEqualHex, assertEqual } from "./assertions.js";

export async function testNativeMuxer_StszAdapter_Conformance_ffmpeg() {

    console.log(
        "=== testNativeMuxer_StszAdapter_Conformance_ffmpeg ==="
    );

    // ---------------------------------------------------------
    // Load golden MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Extract semantic samples (oracle)
    // ---------------------------------------------------------
    const samples = extractVideoSamplesFromMp4({ mp4Bytes: mp4 });

    // ---------------------------------------------------------
    // Adapt → emit
    // ---------------------------------------------------------
    const params = adaptStszFromSamples({ samples });

    const outBytes = serializeBoxTree(
        emitStszBox(params)
    );

    // ---------------------------------------------------------
    // Extract reference STSZ
    // ---------------------------------------------------------
    const refBytes = extractBoxByPathFromMp4(
        mp4,
        "moov/trak/mdia/minf/stbl/stsz"
    );

    assertEqual(
        "stsz.size",
        outBytes.length,
        refBytes.length
    );

    for (let i = 0; i < refBytes.length; i++) {
        assertEqualHex(
            `stsz.byte[${i}]`,
            outBytes[i],
            refBytes[i]
        );
    }

    console.log(
        "PASS: STSZ adapter + emitter reproduce ffmpeg output byte-for-byte"
    );
}
