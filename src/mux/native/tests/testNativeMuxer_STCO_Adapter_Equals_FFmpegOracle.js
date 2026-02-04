import { runGoldenMp4AVTestClient } from "../tests/clients/goldenMp4AVSourceClient.js";

import { prepareTracksForStructuralDerivation } from "../compiler/compileMp4.js";
import { deriveStructuralStateInPlace } from "../derivers/deriveStructuralStateInPlace.js";

import { buildMdatPayloadAndChunkLayout } from "../mdat/buildMdatPayloadAndChunkLayout.js";

import { composeFtypNode } from "../composers/composeFtypNode.js";
import { composeFreeNode } from "../composers/composeFreeNode.js";
import { composeMoovNode } from "../composers/composeMoovNode.js";

import { buildMvhdIntentFromCompilerState } from "../builders/buildMvhdIntentFromCompilerState.js";
import { buildTrakIntentFromTrakAndMvhd } from "../builders/buildTrakIntentFromTrakAndMvhd.js";
import { buildUdtaIntentFromBuildHints } from "../builders/buildUdtaIntentFromBuildHints.js";
import { buildStblChildIntentsWithoutOffsetsInPlace } from "../builders/buildStblChildIntentsWithoutOffsetsInPlace.js";
import { buildStblIntentFromTrack } from "../builders/buildStblIntentFromTrack.js";
import { buildMinfIntentFromTrack } from "../builders/buildMinfIntentFromTrack.js";
import { buildMdiaIntentFromTrack } from "../builders/buildMdiaIntentFromTrack.js";

import { materializePassOneTopLevelBoxes } from "../layout/materializePassOneTopLevelBoxes.js";
import { resolveStcoOffsetsPerTrack } from "../layout/resolveStcoOffsetsPerTrack.js";

import { adaptStcoIntentFromOffsets } from "../adapters/adaptStcoIntentFromOffsets.js";

import { getGoldenTruthBox } from "../tests/goldenTruthExtractors/index.js";
import { assertObjectEqual } from "../tests/assertions.js";

import {
    assertEqual,
} from "./assertions.js";

export async function testNativeMuxer_STCO_Adapter_Equals_FFmpegOracle() {

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
        // Build TRAKs
        // ---------------------------------------------------------
        const trakIntents = [];

        mp4CompilerState.storedIntent.mvhd = buildMvhdIntentFromCompilerState({ mp4CompilerState });
        for (const track of mp4CompilerState.tracks) {

            deriveStructuralStateInPlace({ track });
            buildStblChildIntentsWithoutOffsetsInPlace({ track });

            track.storedIntent.stblIntent = buildStblIntentFromTrack({ track });
            track.storedIntent.minfIntent = buildMinfIntentFromTrack({ track });
            track.storedIntent.mdiaIntent = buildMdiaIntentFromTrack({ track });

            track.storedIntent.trakIntent = buildTrakIntentFromTrakAndMvhd({
                track,
                mvhd: mp4CompilerState.storedIntent.mvhd
            });

            trakIntents.push(track.storedIntent.trakIntent);
        }

        mp4CompilerState.mdatPayloadAndChunkLayout = buildMdatPayloadAndChunkLayout({ mp4CompilerState });

        // ---------------------------------------------------------
        // Build UDTA (if any)
        // ---------------------------------------------------------
        const udtaIntent = buildUdtaIntentFromBuildHints({ buildHints: mp4CompilerState.buildHints });

        mp4CompilerState.storedTopLevelNodes.ftyp = composeFtypNode();
        mp4CompilerState.storedTopLevelNodes.free = composeFreeNode();
        mp4CompilerState.storedTopLevelNodes.moov = composeMoovNode({
            mvhdIntent: mp4CompilerState.storedIntent.mvhd,
            trakIntents,
            udtaIntent
        });

        // ---------------------------------------------------------
        // Act: materialize pass-one boxes
        // ---------------------------------------------------------
        const boxesBeforeMdat = materializePassOneTopLevelBoxes({
            topLevelNodes: mp4CompilerState.storedTopLevelNodes,
            fileBoxOrder: mp4CompilerState.buildParameters.fileBoxOrder
        });

        const mdatStartOffset = boxesBeforeMdat.reduce( (sum, box) => sum + box.byteLength, 0);

        const perTrackStcoOffsets = resolveStcoOffsetsPerTrack({
            tracks: mp4CompilerState.tracks,
            mdatChunkLayout: mp4CompilerState.mdatPayloadAndChunkLayout.mdatChunkLayout,
            mdatStartOffset
        });

        // ---------------------------------------------------------
        // ADAPTER UNDER TEST
        // ---------------------------------------------------------
        const compilerStcoIntents = [];

        for (let trackIndex = 0; trackIndex < mp4CompilerState.tracks.length; trackIndex++) {

            //console.log( "DEBUG perTrackStcoOffsets[trackIndex]", trackIndex, perTrackStcoOffsets[trackIndex]);

            compilerStcoIntents.push(
                adaptStcoIntentFromOffsets({
                    chunkOffsets: perTrackStcoOffsets[trackIndex]
                })
            );
        }

        // ---------------------------------------------------------
        // Assertions — STCO adapter vs oracle emitter input
        // ---------------------------------------------------------

        for (let trackIndex = 0; trackIndex < compilerStcoIntents.length; trackIndex++) {

            const compilerIntent = compilerStcoIntents[trackIndex];

            const oracleStcoBox =
                getGoldenTruthBox
                .getSemanticBoxDataByPathFromMp4File(
                    mp4Bytes,
                    `moov/trak[${trackIndex}]/mdia/minf/stbl/stco`
                );

            const oracleIntent = oracleStcoBox.getEmitterInput();

            // -----------------------------------------------------
            // Shape
            // -----------------------------------------------------

            assertEqual(
                `${fixture}: trak[${trackIndex}] entryCount`,
                compilerIntent.entryCount,
                oracleIntent.chunkOffsets.length
            );

            assertEqual(
                `${fixture}: trak[${trackIndex}] chunkOffsets length`,
                compilerIntent.chunkOffsets.length,
                oracleIntent.chunkOffsets.length
            );

            // -----------------------------------------------------
            // Values (absolute file chunkOffsets)
            // -----------------------------------------------------

            for (let i = 0; i < oracleIntent.chunkOffsets.length; i++) {
                assertEqual(
                    `${fixture}: trak[${trackIndex}] chunkOffset[${i}]`,
                    compilerIntent.chunkOffsets[i],
                    oracleIntent.chunkOffsets[i]
                );
            }
        }

    }
}
