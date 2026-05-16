import { runGoldenMp4AVTestClient } from "./clients/goldenMp4AVSourceClient.js";
import { prepareTracksForStructuralDerivation } from "../compiler/compileMp4.js";
import { deriveStructuralStateInPlace } from "../derivers/deriveStructuralStateInPlace.js";
import { buildStblChildIntentsWithoutOffsetsInPlace } from "../builders/buildStblChildIntentsWithoutOffsetsInPlace.js";
import { buildStblIntentFromTrack } from "../builders/buildStblIntentFromTrack.js";
import { buildMinfIntentFromTrack } from "../builders/buildMinfIntentFromTrack.js";
import { buildMdiaIntentFromTrack } from "../builders/buildMdiaIntentFromTrack.js";
import { buildTrakIntentFromTrakAndMvhd } from "../builders/buildTrakIntentFromTrakAndMvhd.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { assertBytesWithStubbedStco } from "./assertBytesWithStubbedStco.js";
import { buildMvhdIntentFromCompilerState } from "../builders/buildMvhdIntentFromCompilerState.js";

export async function testNativeMuxer_TRAK_Except_STCO_Equals_FFmpegOracle() {


    const fixtures = [
        "reference/reference_av.mp4",
        "reference/reference_av_opus.mp4",
    ];

    const failures = [];

    for (const fixture of fixtures) {

        console.log("\n====================================================");
        console.log("FIXTURE:", fixture);
        console.log("====================================================");

        try {

            const resp = await fetch(fixture);
            const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

            const mp4CompilerState =
                await runGoldenMp4AVTestClient({ mp4Bytes });

            prepareTracksForStructuralDerivation({ mp4CompilerState });

            mp4CompilerState.storedIntent.mvhd =
                buildMvhdIntentFromCompilerState({ mp4CompilerState });

            for (let trackIndex = 0; trackIndex < mp4CompilerState.tracks.length; trackIndex++) {

                const track = mp4CompilerState.tracks[trackIndex];

                console.log(
                    `Fixture: ${fixture} track ${track.semanticCore.codec.codec}`
                );

                try {

                    deriveStructuralStateInPlace({ track });
                    buildStblChildIntentsWithoutOffsetsInPlace({ track });

                    track.storedIntent.stblIntent =
                        buildStblIntentFromTrack({ track });

                    track.storedIntent.minfIntent =
                        buildMinfIntentFromTrack({ track });

                    track.storedIntent.mdiaIntent =
                        buildMdiaIntentFromTrack({ track });

                    track.storedIntent.trakIntent =
                        buildTrakIntentFromTrakAndMvhd({
                            track,
                            mvhd: mp4CompilerState.storedIntent.mvhd
                        });

                    const compilerTrakBytes =
                        serializeBoxTree(
                            EmitterRegistry.assemble(
                                "moov/trak",
                                track.storedIntent.trakIntent
                            )
                        );

                    const oracleTrakBytes =
                        getGoldenTruthBox
                            .getSemanticBoxDataByPathFromMp4File(
                                mp4Bytes,
                                `moov/trak[${trackIndex}]`
                            )
                            .readBoxReport()
                            .raw;

                    const oracleTkhdExtractor =
                        getGoldenTruthBox
                            .getSemanticBoxDataByPathFromMp4File(
                                mp4Bytes,
                                `moov/trak[${trackIndex}]/tkhd`
                            );

                    const compilerTkhdExtractor =
                        getGoldenTruthBox
                            .getSemanticBoxDataFromBox({
                                boxBytes: compilerTrakBytes,
                                sourceRegistryKey: "moov/trak/tkhd",
                                targetBoxPath: "moov/trak/tkhd"
                            });

                    console.log(
                        `Fixture: ${fixture} track ${track.semanticCore.codec.codec} - oracleTkhdIntent`,
                        oracleTkhdExtractor.getEmitterInput()
                    );

                    console.log(
                        `Fixture: ${fixture} track ${track.semanticCore.codec.codec} - compilerTkhdIntent`,
                        compilerTkhdExtractor.getEmitterInput()
                    );

                    console.log(
                        `Fixture: ${fixture} track ${track.semanticCore.codec.codec} - oracleTkhd Header`,
                        oracleTkhdExtractor.readBoxReport().box.header
                    );

                    console.log(
                        `Fixture: ${fixture} track ${track.semanticCore.codec.codec} - compilerTkhd Header`,
                        compilerTkhdExtractor.readBoxReport().box.header
                    );

                    const tkhdOffset = 8;

                    console.log(
                        "compiler",
                        Array.from(
                            compilerTrakBytes.slice(tkhdOffset, tkhdOffset + 32)
                        ).map(b => b.toString(16).padStart(2, "0")).join(" ")
                    );

                    console.log(
                        "oracle",
                        Array.from(
                            oracleTrakBytes.slice(tkhdOffset, tkhdOffset + 32)
                        ).map(b => b.toString(16).padStart(2, "0")).join(" ")
                    );

                    assertBytesWithStubbedStco({
                        fixture,
                        compilerBytes: compilerTrakBytes,
                        oracleBytes: oracleTrakBytes,
                        labelPrefix: `track[${trackIndex}].trak`,
                    });

                } catch (err) {

                    failures.push({
                        fixture,
                        trackIndex,
                        codec: track.semanticCore.codec.codec,
                        error: err
                    });

                    console.error("TRAK comparison failed:", err);
                }
            }

        } catch (err) {

            failures.push({
                fixture,
                error: err
            });

            console.error("UNHANDLED ERROR:", err);
        }
    }

    // ---------------------------------------------------------
    // Final result
    // ---------------------------------------------------------
    if (failures.length) {

        console.error("\n================ TRAK FAILURES ================");

        for (const f of failures) {
            console.error(
                `Fixture ${f.fixture}, track ${f.trackIndex ?? "?"} (${f.codec ?? "?"})`,
                f.error?.message ?? f.error
            );
        }

        throw new Error(
            `TRAK mismatch: ${failures.length} failing case(s)`
        );
    }
}
