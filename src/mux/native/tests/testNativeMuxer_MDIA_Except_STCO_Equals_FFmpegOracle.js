import { runGoldenMp4AVTestClient } from "./clients/goldenMp4AVSourceClient.js";
import { prepareTracksForStructuralDerivation } from "../compiler/compileMp4.js";
import { deriveStructuralStateInPlace } from "../derivers/deriveStructuralStateInPlace.js";
import { buildStblChildIntentsWithoutOffsetsInPlace } from "../builders/buildStblChildIntentsWithoutOffsetsInPlace.js";
import { buildStblIntentFromTrack } from "../builders/buildStblIntentFromTrack.js";
import { buildMinfIntentFromTrack } from "../builders/buildMinfIntentFromTrack.js";
import { buildMdiaIntentFromTrack } from "../builders/buildMdiaIntentFromTrack.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { assertBytesWithStubbedStco } from "./assertBytesWithStubbedStco.js";

export async function testNativeMuxer_MDIA_Except_STCO_Equals_FFmpegOracle() {

    const fixtures = [
        "reference/reference_av.mp4",
        "reference/reference_av_opus.mp4",
    ];

    for (const fixture of fixtures) {
        
        const resp = await fetch(fixture);
        const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

        const mp4CompilerState =
            await runGoldenMp4AVTestClient({ mp4Bytes });

        prepareTracksForStructuralDerivation({ mp4CompilerState });

        for (let trackIndex = 0; trackIndex < mp4CompilerState.tracks.length; trackIndex++) {

            const track = mp4CompilerState.tracks[trackIndex];

            // build intents up to mdia
            deriveStructuralStateInPlace({ track });
            buildStblChildIntentsWithoutOffsetsInPlace({ track });
            track.storedIntent.stblIntent = buildStblIntentFromTrack({ track });
            track.storedIntent.minfIntent = buildMinfIntentFromTrack({ track });

            const mdiaIntent = buildMdiaIntentFromTrack({ track });

            const oracleMdhd =
                getGoldenTruthBox
                .getSemanticBoxDataByPathFromMp4File(
                    mp4Bytes,
                    `moov/trak[${trackIndex}]/mdia/mdhd`
                )
                .getEmitterInput()

            // emit compiler mdia
            const compilerMdiaBytes =
                serializeBoxTree(
                    EmitterRegistry.assemble(
                        "moov/trak/mdia",
                        mdiaIntent
                    )
                );

            // extract oracle mdia
            const oracleMdiaBytes =
                getGoldenTruthBox
                .getSemanticBoxDataByPathFromMp4File(
                    mp4Bytes,
                    `moov/trak[${trackIndex}]/mdia`
                )
                .readBoxReport()
                .raw;

            // byte-compare with STCO skipped
            assertBytesWithStubbedStco({
                fixture,
                compilerBytes: compilerMdiaBytes,
                oracleBytes: oracleMdiaBytes,
                expectedStcoEntryCount: track.chunks.length,
                labelPrefix: `track[${trackIndex}].mdia`,
            });
        }
    }
}
