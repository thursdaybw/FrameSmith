import { runGoldenMp4AVTestClient } from "./clients/goldenMp4AVSourceClient.js";

import { prepareTracksForStructuralDerivation } from "../compiler/compileMp4.js";
import { deriveStructuralStateInPlace } from "../derivers/deriveStructuralStateInPlace.js";

import { buildMvhdIntentFromCompilerState } from "../builders/buildMvhdIntentFromCompilerState.js";
import { buildMdiaIntentFromTrack } from "../builders/buildMdiaIntentFromTrack.js";
import { buildTrakIntentFromTrakAndMvhd } from "../builders/buildTrakIntentFromTrakAndMvhd.js";
import { buildStblChildIntentsWithoutOffsetsInPlace } from "../builders/buildStblChildIntentsWithoutOffsetsInPlace.js";
import { buildStblIntentFromTrack } from "../builders/buildStblIntentFromTrack.js";
import { buildMinfIntentFromTrack } from "../builders/buildMinfIntentFromTrack.js";

import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";

import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

export async function testNativeMuxer_ElstIntent_Debug() {

    const fixtures = [
        "reference/reference_av.mp4",
        "reference/reference_av_opus.mp4",
    ];

    for (const fixture of fixtures) {

        console.log("\n====================================================");
        console.log("FIXTURE:", fixture);
        console.log("====================================================");

        const resp = await fetch(fixture);
        const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

        const mp4CompilerState =
            await runGoldenMp4AVTestClient({ mp4Bytes });

        prepareTracksForStructuralDerivation({ mp4CompilerState });

        mp4CompilerState.storedIntent.mvhd =
            buildMvhdIntentFromCompilerState({ mp4CompilerState });

        for (let trackIndex = 0; trackIndex < mp4CompilerState.tracks.length; trackIndex++) {

            const track = mp4CompilerState.tracks[trackIndex];

            console.log("\n--------------------------------------------");
            console.log(
                `TRACK ${trackIndex} (${track.semanticCore.codec.codec})`
            );
            console.log("--------------------------------------------");

            deriveStructuralStateInPlace({ track });

            buildStblChildIntentsWithoutOffsetsInPlace({ track });

            track.storedIntent.stblIntent = buildStblIntentFromTrack({ track });

            track.storedIntent.minfIntent = buildMinfIntentFromTrack({ track });

            track.storedIntent.mdiaIntent = buildMdiaIntentFromTrack({ track });

            track.storedIntent.trakIntent = buildTrakIntentFromTrakAndMvhd({
                    track,
                    mvhd: mp4CompilerState.storedIntent.mvhd
                });

            // --------------------------------------------------
            // Compiler trak bytes
            // --------------------------------------------------
            const compilerTrakBytes =
                serializeBoxTree(
                    EmitterRegistry.assemble(
                        "moov/trak",
                        track.storedIntent.trakIntent
                    )
                );

            // --------------------------------------------------
            // ORACLE elst extractor
            // --------------------------------------------------
            const oracleElstExtractor =
                getGoldenTruthBox
                .getSemanticBoxDataByPathFromMp4File(
                    mp4Bytes,
                    `moov/trak[${trackIndex}]/edts/elst`
                );

            // --------------------------------------------------
            // COMPILER elst extractor
            // --------------------------------------------------
            const compilerElstExtractor =
                getGoldenTruthBox
                .getSemanticBoxDataFromBox({
                    boxBytes: compilerTrakBytes,
                    sourceRegistryKey: "moov/trak",
                    targetBoxPath: "moov/trak/edts/elst"
                });

            console.log("ORACLE elst intent:");
            console.log(
                oracleElstExtractor.getEmitterInput()
            );

            console.log("COMPILER elst intent:");
            console.log(
                compilerElstExtractor.getEmitterInput()
            );

            console.log(
                "ORACLE elst header:",
                oracleElstExtractor.readBoxReport().box.header
            );

            console.log(
                "COMPILER elst header:",
                compilerElstExtractor.readBoxReport().box.header
            );
        }
    }
}
