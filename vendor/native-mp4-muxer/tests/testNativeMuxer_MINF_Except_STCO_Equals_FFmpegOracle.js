import { runGoldenMp4AVTestClient } from "./clients/goldenMp4AVSourceClient.js";
import { assertBytesWithStubbedStco } from "./assertBytesWithStubbedStco.js";
import { prepareTracksForStructuralDerivation } from "../compiler/compileMp4.js";
import { deriveStructuralStateInPlace } from "../derivers/deriveStructuralStateInPlace.js";
import { buildStblChildIntentsWithoutOffsetsInPlace } from "../builders/buildStblChildIntentsWithoutOffsetsInPlace.js";
import { buildStblIntentFromTrack } from "../builders/buildStblIntentFromTrack.js";
import { buildMinfIntentFromTrack } from "../builders/buildMinfIntentFromTrack.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

export async function testNativeMuxer_MINF_Except_STCO_Equals_FFmpegOracle() {

    const fixtures = [
        "reference/reference_av.mp4",
        "reference/reference_av_opus.mp4",
    ];

    for (const fixture of fixtures) {

        // ---------------------------------------------------------
        // Load oracle MP4
        // ---------------------------------------------------------
        const resp = await fetch(fixture);
        const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

        // ---------------------------------------------------------
        // Run golden client (semantic inputs)
        // ---------------------------------------------------------
        const mp4CompilerState = await runGoldenMp4AVTestClient({ mp4Bytes });

        // ---------------------------------------------------------
        // Compiler up to MINF (no offsets)
        // ---------------------------------------------------------
        prepareTracksForStructuralDerivation({ mp4CompilerState });

        for (const track of mp4CompilerState.tracks) {
            deriveStructuralStateInPlace({ track });
            buildStblChildIntentsWithoutOffsetsInPlace({ track });

            track.storedIntent.stblIntent = buildStblIntentFromTrack({ track });
            track.storedIntent.minfIntent = buildMinfIntentFromTrack({ track });
        }

        // ---------------------------------------------------------
        // Per-track MINF comparison (excluding STCO)
        // ---------------------------------------------------------
        for (let trackIndex = 0; trackIndex < mp4CompilerState.tracks.length; trackIndex++) {
            const track = mp4CompilerState.tracks[trackIndex];

            // Emit compiler MINF
            const compilerMinfBytes = serializeBoxTree(EmitterRegistry.assemble("moov/trak/mdia/minf", track.storedIntent.minfIntent));

            // Extract oracle MINF
            const oracleMinfBytes = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(mp4Bytes, `moov/trak[${trackIndex}]/mdia/minf`).readBoxReport().raw;

            const oracleIntent = getGoldenTruthBox.getSemanticBoxDataFromBox({
                boxBytes: oracleMinfBytes,
                sourceRegistryKey: `moov/trak/mdia/minf`,
                targetBoxPath: `moov/trak/mdia/minf`,
            }).getEmitterInput();

            const compilerIntent = getGoldenTruthBox.getSemanticBoxDataFromBox({
                boxBytes: compilerMinfBytes,
                sourceRegistryKey: `moov/trak/mdia/minf`,
                targetBoxPath: `moov/trak/mdia/minf`,
            }).getEmitterInput();

            // -----------------------------------------------------
            // Byte-for-byte compare with stubbed STCO
            // -----------------------------------------------------
            assertBytesWithStubbedStco({
                fixture,
                compilerBytes: compilerMinfBytes,
                oracleBytes: oracleMinfBytes,
                expectedStcoEntryCount: track.chunks.length,
                labelPrefix: `fixture ${fixture}, track[${trackIndex}].minf`,
                containerHeaderSize: 8
            });
        }
    }
}
