import { runGoldenMp4AVTestClient } from "./clients/goldenMp4AVSourceClient.js";
import { prepareTracksForStructuralDerivation } from "../compiler/compileMp4.js";
import { buildMvhdIntentFromCompilerState } from "../builders/buildMvhdIntentFromCompilerState.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import {
    assertExists,
    assertEqual,
    assertEqualHex,
    assertEqualHexCollect,
} from "./assertions.js";

export async function testNativeMuxer_MVHD_Builder_Equals_FFmpegOpusOracle() {

    // ---------------------------------------------------------
    // Load oracle MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_av_opus.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Build compiler state via golden client
    // ---------------------------------------------------------
    const mp4CompilerState = await runGoldenMp4AVTestClient({ mp4Bytes });

    // ---------------------------------------------------------
    // Perform canonical compiler pre-pass
    // ---------------------------------------------------------
    prepareTracksForStructuralDerivation({ mp4CompilerState });

    // ---------------------------------------------------------
    // Build mvhd intent from compiler state
    // ---------------------------------------------------------
    console.log("mp4CompilerState", mp4CompilerState); 
    const mvhdIntent = buildMvhdIntentFromCompilerState({ mp4CompilerState });

    // ---------------------------------------------------------
    // Emit mvhd bytes
    // ---------------------------------------------------------
    const emittedMvhdBytes = serializeBoxTree(EmitterRegistry.emit("moov/mvhd", mvhdIntent));

    // ---------------------------------------------------------
    // Extract oracle mvhd (retain extractor)
    // ---------------------------------------------------------
    const oracleMvhdExtractor =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4Bytes,
                "moov/mvhd"
            );

    const oracleMvhdBytes =
        oracleMvhdExtractor
            .readBoxReport()
            .raw;


    const emittedMvhdExtractor = getGoldenTruthBox.getSemanticBoxDataFromBox({
            boxBytes: emittedMvhdBytes,
            sourceRegistryKey: "moov/mvhd",
            targetBoxPath: "moov/mvhd" 
        }); 
     

    console.log("Oracle box, header, fields, children", oracleMvhdExtractor.readBoxReport().box);
    console.log("Emitted box, header, fields, children", emittedMvhdExtractor.readBoxReport().box);

    diffFlatIntent({
        produced: mvhdIntent,
        oracle: oracleMvhdExtractor.getEmitterInput(),
        label: "mvhd intent"
    });

    // ---------------------------------------------------------
    // Byte-for-byte equivalence
    // ---------------------------------------------------------
    const diffs = [];

    const byteCount =
        Math.max(
            emittedMvhdBytes.length,
            oracleMvhdBytes.length
        );

    for (let i = 0; i < byteCount; i++) {
        assertEqualHexCollect(
            diffs,
            `mvhd.byte[${i}]`,
            emittedMvhdBytes[i],
            oracleMvhdBytes[i]
        );
    }

    if (diffs.length) {
        console.table(diffs);
        throw new Error(
            `mvhd mismatch: ${diffs.length} bytes differ`
        );
    }
}

export async function testNativeMuxer_MVHD_Builder_Equals_FFmpegMp4aOracle() {

    // ---------------------------------------------------------
    // Load oracle MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Build compiler state via golden client
    // ---------------------------------------------------------
    const mp4CompilerState = await runGoldenMp4AVTestClient({ mp4Bytes });

    // ---------------------------------------------------------
    // Perform canonical compiler pre-pass
    // ---------------------------------------------------------
    prepareTracksForStructuralDerivation({ mp4CompilerState });

    // ---------------------------------------------------------
    // Build mvhd intent from compiler state
    // ---------------------------------------------------------
    console.log("mp4CompilerState", mp4CompilerState); 
    const mvhdIntent = buildMvhdIntentFromCompilerState({ mp4CompilerState });

    // ---------------------------------------------------------
    // Emit mvhd bytes
    // ---------------------------------------------------------
    const emittedMvhdBytes = serializeBoxTree(EmitterRegistry.emit("moov/mvhd", mvhdIntent));

    // ---------------------------------------------------------
    // Extract oracle mvhd (retain extractor)
    // ---------------------------------------------------------
    const oracleMvhdExtractor =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4Bytes,
                "moov/mvhd"
            );

    const oracleMvhdBytes =
        oracleMvhdExtractor
            .readBoxReport()
            .raw;


    const emittedMvhdExtractor = getGoldenTruthBox.getSemanticBoxDataFromBox({
            boxBytes: emittedMvhdBytes,
            sourceRegistryKey: "moov/mvhd",
            targetBoxPath: "moov/mvhd" 
        }); 
     

    console.log("Oracle box, header, fields, children", oracleMvhdExtractor.readBoxReport().box);
    console.log("Emitted box, header, fields, children", emittedMvhdExtractor.readBoxReport().box);

    diffFlatIntent({
        produced: mvhdIntent,
        oracle: oracleMvhdExtractor.getEmitterInput(),
        label: "mvhd intent"
    });

    // ---------------------------------------------------------
    // Byte-for-byte equivalence
    // ---------------------------------------------------------
    const diffs = [];

    const byteCount =
        Math.max(
            emittedMvhdBytes.length,
            oracleMvhdBytes.length
        );

    for (let i = 0; i < byteCount; i++) {
        assertEqualHexCollect(
            diffs,
            `mvhd.byte[${i}]`,
            emittedMvhdBytes[i],
            oracleMvhdBytes[i]
        );
    }

    if (diffs.length) {
        console.table(diffs);
        throw new Error(
            `mvhd mismatch: ${diffs.length} bytes differ`
        );
    }
}

export function diffFlatIntent({ produced, oracle, label }) {

    const diffs = [];

    const keys = new Set([
        ...Object.keys(produced),
        ...Object.keys(oracle)
    ]);

    for (const key of keys) {

        const a = produced[key];
        const b = oracle[key];

        if (a !== b) {
            diffs.push({
                field: key,
                produced: a,
                oracle: b
            });
        }
    }

    if (diffs.length) {
        console.group(label ?? "Intent diff");
        console.table(diffs);
        console.groupEnd();

        throw new Error(
            `${label ?? "intent"} mismatch: ${diffs.length} field(s) differ`
        );
    }
}
