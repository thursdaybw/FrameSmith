import { runGoldenMp4AVTestClient } from "./clients/goldenMp4AVSourceClient.js";

import { prepareTracksForStructuralDerivation } from "../compiler/compileMp4.js";
import { deriveStructuralStateInPlace } from "../derivers/deriveStructuralStateInPlace.js";

import { buildStblChildIntentsWithoutOffsetsInPlace } from "../builders/buildStblChildIntentsWithoutOffsetsInPlace.js";
import { buildStblIntentFromTrack } from "../builders/buildStblIntentFromTrack.js";

import { buildMvhdIntentFromCompilerState } from "../builders/buildMvhdIntentFromCompilerState.js";
import { buildMinfIntentFromTrack } from "../builders/buildMinfIntentFromTrack.js";
import { buildMdiaIntentFromTrack } from "../builders/buildMdiaIntentFromTrack.js";
import { buildTrakIntentFromTrakAndMvhd } from "../builders/buildTrakIntentFromTrakAndMvhd.js";
import { buildUdtaIntentFromBuildHints } from "../builders/buildUdtaIntentFromBuildHints.js";

import { buildMdatPayloadAndChunkLayout } from "../mdat/buildMdatPayloadAndChunkLayout.js";

import { composeMoovNode } from "../composers/composeMoovNode.js";
import { composeFtypNode } from "../composers/composeFtypNode.js";
import { composeFreeNode } from "../composers/composeFreeNode.js";

import { materializePassOneTopLevelBoxes } from "../layout/materializePassOneTopLevelBoxes.js";
import { resolveStcoOffsetsPerTrack } from "../layout/resolveStcoOffsetsPerTrack.js";

import { commitResolvedStcoIntentsToTracks } from "../commit/commitResolvedStcoIntentsToTracks.js";

import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";

import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { assertEqualHexCollect } from "./assertions.js";

export async function testNativeMuxer_STBL_WithResolvedSTCO_Equals_FFmpegOracle() {

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
        // Compiler up to STBL (no offsets yet)
        // ---------------------------------------------------------
        prepareTracksForStructuralDerivation({ mp4CompilerState });

        for (const track of mp4CompilerState.tracks) {
            deriveStructuralStateInPlace({ track });
            buildStblChildIntentsWithoutOffsetsInPlace({ track });
            track.storedIntent.stblIntent = buildStblIntentFromTrack({ track });
        }

        // ---------------------------------------------------------
        // Build TRAKs + MOOV (structure only)
        // ---------------------------------------------------------
        mp4CompilerState.storedIntent.mvhd = buildMvhdIntentFromCompilerState({ mp4CompilerState });

        const trakIntents = [];

        for (const track of mp4CompilerState.tracks) {
            track.storedIntent.minfIntent = buildMinfIntentFromTrack({ track });
            track.storedIntent.mdiaIntent = buildMdiaIntentFromTrack({ track });

            track.storedIntent.trakIntent = buildTrakIntentFromTrakAndMvhd({
                    track,
                    mvhd: mp4CompilerState.storedIntent.mvhd
                });

            trakIntents.push(track.storedIntent.trakIntent);
        }

        mp4CompilerState.storedTopLevelNodes.ftyp = composeFtypNode();
        mp4CompilerState.storedTopLevelNodes.free = composeFreeNode();
        mp4CompilerState.storedTopLevelNodes.moov = composeMoovNode({
            mvhdIntent: mp4CompilerState.storedIntent.mvhd,
            trakIntents,
            udtaIntent: buildUdtaIntentFromBuildHints({
                buildHints: mp4CompilerState.buildHints
            })
        });

        // ---------------------------------------------------------
        // Build MDAT + resolve STCO offsets
        // ---------------------------------------------------------
        mp4CompilerState.mdatPayloadAndChunkLayout = buildMdatPayloadAndChunkLayout({ mp4CompilerState });

        const boxesBeforeMdat = materializePassOneTopLevelBoxes({
            topLevelNodes: mp4CompilerState.storedTopLevelNodes,
            fileBoxOrder: mp4CompilerState.buildParameters.fileBoxOrder
        });

        const mdatStartOffset = boxesBeforeMdat.reduce((n, b) => n + b.byteLength, 0);

        const perTrackStcoOffsets = resolveStcoOffsetsPerTrack({
            tracks: mp4CompilerState.tracks,
            mdatChunkLayout:
                mp4CompilerState.mdatPayloadAndChunkLayout.mdatChunkLayout,
            mdatStartOffset
        });

        // ---------------------------------------------------------
        // Commit resolved STCO intents to tracks
        // ---------------------------------------------------------
        commitResolvedStcoIntentsToTracks({
            tracks: mp4CompilerState.tracks,
            perTrackStcoOffsets
        });

        // Rebuild STBL intents (now with real STCO)
        for (const track of mp4CompilerState.tracks) {
            track.storedIntent.stblIntent = buildStblIntentFromTrack({ track });
        }

        // ---------------------------------------------------------
        // Assertions — full STBL byte-for-byte vs oracle
        // ---------------------------------------------------------
        for (let trackIndex = 0; trackIndex < mp4CompilerState.tracks.length; trackIndex++) {

            const track = mp4CompilerState.tracks[trackIndex];
            console.log("track.storedIntent.stblIntent",track.storedIntent.stblIntent);
            const compilerStblBytes = serializeBoxTree(
                    EmitterRegistry.assemble(
                        "moov/trak/mdia/minf/stbl",
                        track.storedIntent.stblIntent
                    )
                );

            const oracleStblBytes =
                getGoldenTruthBox
                    .getSemanticBoxDataByPathFromMp4File(
                        mp4Bytes,
                        `moov/trak[${trackIndex}]/mdia/minf/stbl`
                    )
                    .readBoxReport()
                    .raw;

            const diffs = [];
            const byteCount = Math.max(compilerStblBytes.length, oracleStblBytes.length);

            for (let i = 0; i < byteCount; i++) {
                assertEqualHexCollect(
                    diffs,
                    `${fixture}: track[${trackIndex}].stbl.byte[${i}]`,
                    compilerStblBytes[i],
                    oracleStblBytes[i]
                );
            }

            if (diffs.length) {
                console.table(diffs.slice(0, 50));
                throw new Error(
                    `${fixture}: STBL mismatch after resolved STCO (${diffs.length} bytes differ, track ${trackIndex})`
                );
            }
        }
    }
}

