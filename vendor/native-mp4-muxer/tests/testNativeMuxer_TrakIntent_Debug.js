import { runGoldenMp4AVTestClient } from "./clients/goldenMp4AVSourceClient.js";

import { prepareTracksForStructuralDerivation } from "../compiler/compileMp4.js";
import { deriveStructuralStateInPlace } from "../derivers/deriveStructuralStateInPlace.js";

import { buildStblChildIntentsWithoutOffsetsInPlace } from "../builders/buildStblChildIntentsWithoutOffsetsInPlace.js";
import { buildStblIntentFromTrack } from "../builders/buildStblIntentFromTrack.js";
import { buildMinfIntentFromTrack } from "../builders/buildMinfIntentFromTrack.js";
import { buildMdiaIntentFromTrack } from "../builders/buildMdiaIntentFromTrack.js";
import { buildTrakIntentFromTrakAndMvhd } from "../builders/buildTrakIntentFromTrakAndMvhd.js";
import { buildMvhdIntentFromCompilerState } from "../builders/buildMvhdIntentFromCompilerState.js";

import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";

import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

export async function testNativeMuxer_TrakIntent_Debug() {

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

        mp4CompilerState.storedIntent.mvhd = buildMvhdIntentFromCompilerState({ mp4CompilerState });

        for (let trackIndex = 0; trackIndex < mp4CompilerState.tracks.length; trackIndex++) {

            const track = mp4CompilerState.tracks[trackIndex];
            const codec = track.semanticCore.codec.codec;

            console.log("\n--------------------------------------------");
            console.log(`TRACK ${trackIndex} (${codec})`);
            console.log("--------------------------------------------");

            deriveStructuralStateInPlace({ track });
            buildStblChildIntentsWithoutOffsetsInPlace({ track });

            track.storedIntent.stblIntent = buildStblIntentFromTrack({ track });
            track.storedIntent.minfIntent = buildMinfIntentFromTrack({ track });
            track.storedIntent.mdiaIntent = buildMdiaIntentFromTrack({ track });

            track.storedIntent.trakIntent =
                buildTrakIntentFromTrakAndMvhd({
                    track,
                    mvhd: mp4CompilerState.storedIntent.mvhd
                });

            // -------------------------------------------------
            // Extract oracle tkhd intent
            // -------------------------------------------------
            const oracleTkhdExtractor =
                getGoldenTruthBox
                    .getSemanticBoxDataByPathFromMp4File(
                        mp4Bytes,
                        `moov/trak[${trackIndex}]/tkhd`
                    );

            const oracleTkhdIntent =
                oracleTkhdExtractor.getEmitterInput();

            // -------------------------------------------------
            // Extract compiler tkhd intent
            // -------------------------------------------------
            const compilerTrakBytes =
                serializeBoxTree(
                    EmitterRegistry.assemble(
                        "moov/trak",
                        track.storedIntent.trakIntent
                    )
                );

            const compilerTkhdExtractor =
                getGoldenTruthBox.getSemanticBoxDataFromBox({
                    boxBytes: compilerTrakBytes,
                    sourceRegistryKey: "moov/trak",
                    targetBoxPath: "moov/trak/tkhd"
                });

            const compilerTkhdIntent =
                compilerTkhdExtractor.getEmitterInput();

            // -------------------------------------------------
            // Print intent comparison (this is the core)
            // -------------------------------------------------
            console.log("ORACLE tkhd intent:");
            console.log(JSON.stringify(oracleTkhdIntent, null, 2));

            console.log("COMPILER tkhd intent:");
            console.log(JSON.stringify(compilerTkhdIntent, null, 2));

            // -------------------------------------------------
            // Optional: header comparison
            // -------------------------------------------------
            console.log("ORACLE tkhd header:",
                oracleTkhdExtractor.readBoxReport().box.header
            );

            console.log("COMPILER tkhd header:",
                compilerTkhdExtractor.readBoxReport().box.header
            );
        }
    }
}
