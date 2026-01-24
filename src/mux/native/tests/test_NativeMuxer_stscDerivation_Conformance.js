import { extractSemanticAccessUnitsFromMp4 } from "./reference/extractSemanticAccessUnitsFromMp4.js";
import { deriveChunkModel } from "../derivers/deriveChunkModel.js";
import { deriveStscEntries } from "../derivers/deriveStscEntries.js";
import { adaptStscEntriesToEmitterParams } from "../adapters/adaptStscEntriesToEmitterParams.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import {
    findBoxesByPathFromMp4,
} from "./reference/BoxExtractor.js";
import { assertEqualHex, assertEqual } from "./assertions.js";
import { ChunkingStrategies } from "../derivers/strategies/chunkingStrategies.js";


export async function testNativeMuxer_StscDerivation_Conformance_ffmpeg() {

    console.log(
        "=== testNativeMuxer_StscDerivation_Conformance_ffmpeg ==="
    );

    console.warn(
        "⚠️ TODO: This test currently validates STSC derivation against the VIDEO oracle only.\n" +
        "It must be upgraded to run against the AUDIO oracle (trak[1]) once audio derivation\n" +
        "is exercised end-to-end in NativeMuxer."
    );

    // ---------------------------------------------------------
    // 1. Load golden MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Extract semantic samples (oracle)
    // ---------------------------------------------------------
    const samples = extractSemanticAccessUnitsFromMp4({
        mp4Bytes: mp4
    });

    // ---------------------------------------------------------
    // 3. Derive chunk model (policy-free)
    // ---------------------------------------------------------
    const chunks = deriveChunkModel(
        samples,
        ChunkingStrategies.ALL_SAMPLES_ONE_CHUNK
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
    // 7. Extract reference STSC from golden MP4 (single-track)
    // ---------------------------------------------------------
    const traks = findBoxesByPathFromMp4(mp4, "moov/trak");

    assertEqual("trak.count", traks.length, 1);

    const stscBoxes = findTraversalNodesByPathFromBoxBytes(
            traks[0],
            "mdia/minf/stbl/stsc"
        );

    assertEqual("stsc.box.count", stscBoxes.length, 1);

    const refBytes = stscBoxes[0];

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
