import { runGoldenMp4AVTestClient } from "./clients/goldenMp4AVSourceClient.js";
import { prepareTracksForStructuralDerivation } from "../compiler/compileMp4.js";
import { deriveStructuralStateInPlace } from "../derivers/deriveStructuralStateInPlace.js";
import { buildStblChildIntentsWithoutOffsetsInPlace } from "../builders/buildStblChildIntentsWithoutOffsetsInPlace.js";
import { buildStblIntentFromTrack } from "../builders/buildStblIntentFromTrack.js";
import { buildMinfIntentFromTrack } from "../builders/buildMinfIntentFromTrack.js";
import { buildMdiaIntentFromTrack } from "../builders/buildMdiaIntentFromTrack.js";
import { buildTrakIntentFromTrakAndMvhd } from "../builders/buildTrakIntentFromTrakAndMvhd.js";
import { buildMvhdIntentFromCompilerState } from "../builders/buildMvhdIntentFromCompilerState.js";
import { buildUdtaIntentFromBuildHints } from "../builders/buildUdtaIntentFromBuildHints.js";
import { composeMoovNode } from "../composers/composeMoovNode.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { assertBytesWithStubbedStco } from "./assertBytesWithStubbedStco.js";

export async function testNativeMuxer_MOOV_Except_STCO_Equals_FFmpegOracle() {

    const fixtures = [
        "reference/reference_av.mp4",
        "reference/reference_av_opus.mp4",
    ];

    for (const fixture of fixtures) {

        const resp = await fetch(fixture);
        const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

        const mp4CompilerState = await runGoldenMp4AVTestClient({ mp4Bytes });

        prepareTracksForStructuralDerivation({ mp4CompilerState });

        // ---------------------------------------------------------
        // Build MVHD
        // ---------------------------------------------------------
        const mvhdIntent = buildMvhdIntentFromCompilerState({ mp4CompilerState });

        mp4CompilerState.storedIntent.mvhd = mvhdIntent;

        // ---------------------------------------------------------
        // Build TRAKs
        // ---------------------------------------------------------
        const trakIntents = [];

        for (const track of mp4CompilerState.tracks) {

            deriveStructuralStateInPlace({ track });
            buildStblChildIntentsWithoutOffsetsInPlace({ track });

            track.storedIntent.stblIntent = buildStblIntentFromTrack({ track });
            console.log(`${fixture}: track ${track.semanticCore.codec.codec} track.storedIntent.stblIntent`,track.storedIntent.stblIntent);
            track.storedIntent.minfIntent = buildMinfIntentFromTrack({ track });
            track.storedIntent.mdiaIntent = buildMdiaIntentFromTrack({ track });

            track.storedIntent.trakIntent = buildTrakIntentFromTrakAndMvhd({ track, mvhd: mvhdIntent });

            trakIntents.push(track.storedIntent.trakIntent);
        }

        // ---------------------------------------------------------
        // Build UDTA (if any)
        // ---------------------------------------------------------
        const udtaIntent = buildUdtaIntentFromBuildHints({ buildHints: mp4CompilerState.buildHints });

        // ---------------------------------------------------------
        // Compose MOOV
        // ---------------------------------------------------------
        const compilerMoovNode = composeMoovNode({ mvhdIntent, trakIntents, udtaIntent });
        const compilerMoovBytes = serializeBoxTree(compilerMoovNode);

        // ---------------------------------------------------------
        // Oracle MOOV
        // ---------------------------------------------------------
        const oracleMoovBytes = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(mp4Bytes, "moov").readBoxReport().raw;

        // ---------------------------------------------------------
        // Byte-for-byte comparison (STCO skipped)
        // ---------------------------------------------------------
        const expectedStcoEntryCount = mp4CompilerState.tracks.reduce((sum, t) => sum + t.chunks.length, 0);

        assertBytesWithStubbedStco({
            fixture,
            compilerBytes: compilerMoovBytes,
            oracleBytes: oracleMoovBytes,
            expectedStcoEntryCount,
            labelPrefix: "moov",
        });
    }
}
