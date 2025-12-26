import { extractVideoSamplesFromMp4 } from "./reference/Mp4SampleExtractor.js";
import { deriveChunkModel } from "../deriveChunkModel.js";
import { deriveStscEntries } from "../deriveStscEntries.js";
import { adaptStscEntriesToEmitterParams } from "../adapters/adaptStscEntriesToEmitterParams.js";
import { emitStscBox } from "../box-emitters/stscBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { extractBoxByPathFromMp4 } from "./reference/BoxExtractor.js";
import { assertEqualHex, assertEqual } from "./assertions.js";
import { ChunkPolicies } from "../policies/chunkPolicies.js";

export async function testNativeMuxer_StscDerivation_Conformance_ffmpeg() {

    console.log(
        "=== testNativeMuxer_StscDerivation_Conformance_ffmpeg ==="
    );

    // ---------------------------------------------------------
    // 1. Load golden MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Extract semantic samples (oracle)
    // ---------------------------------------------------------
    const samples = extractVideoSamplesFromMp4({
        mp4Bytes: mp4
    });

    // ---------------------------------------------------------
    // 3. Derive chunk model (policy-free)
    // ---------------------------------------------------------
    const chunks = deriveChunkModel(
        samples,
        ChunkPolicies.ALL_SAMPLES_ONE_CHUNK
    );

    // ---------------------------------------------------------
    // 4. Derive semantic STSC entries
    // ---------------------------------------------------------
    const entries = deriveStscEntries({
        samples,
        chunks
    });

    // ---------------------------------------------------------
    // 5. Adapt semantic entries to emitter parameters
    // ---------------------------------------------------------
    const emitterParams =
        adaptStscEntriesToEmitterParams(entries);

    // ---------------------------------------------------------
    // 6. Emit STSC box
    // ---------------------------------------------------------
    const outBytes = serializeBoxTree(
        emitStscBox(emitterParams)
    );

    // ---------------------------------------------------------
    // 7. Extract reference STSC from golden MP4
    // ---------------------------------------------------------
    const refBytes = extractBoxByPathFromMp4(
        mp4,
        "moov/trak/mdia/minf/stbl/stsc"
    );

    // ---------------------------------------------------------
    // 8. Byte-for-byte equivalence
    // ---------------------------------------------------------
    assertEqual(
        "stsc.size",
        outBytes.length,
        refBytes.length
    );

    for (let i = 0; i < refBytes.length; i++) {
        assertEqualHex(
            `stsc.byte[${i}]`,
            outBytes[i],
            refBytes[i]
        );
    }

    console.log(
        "PASS: STSC derivation + adapter + emitter reproduce ffmpeg output byte-for-byte"
    );
}
