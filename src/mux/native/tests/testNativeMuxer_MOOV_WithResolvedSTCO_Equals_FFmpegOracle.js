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
import { resolveStcoOffsetsPerTrack } from "../layout/resolveStcoOffsetsPerTrack.js";
//import { commitResolvedStcoIntentsToTracks } from "../commit/commitResolvedStcoIntentsToTracks.js";

import { composeMoovNode } from "../composers/composeMoovNode.js";
import { composeFtypNode } from "../composers/composeFtypNode.js";
import { composeFreeNode } from "../composers/composeFreeNode.js";

import { materializePassOneTopLevelBoxes } from "../layout/materializePassOneTopLevelBoxes.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";

import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import {
    assertExists,
    assertEqual,
    assertEqualHexCollect
} from "./assertions.js";

import { adaptStcoIntentFromOffsets } from "../adapters/adaptStcoIntentFromOffsets.js";

export async function testNativeMuxer_MOOV_WithResolvedSTCO_Equals_FFmpegOracle() {

    const fixtures = [
        "reference/reference_av.mp4",
        "reference/reference_av_opus.mp4",
    ];

    for (const fixture of fixtures) {

        // =====================================================
        // Load oracle
        // =====================================================
        const resp = await fetch(fixture);
        const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

        const mp4CompilerState = await runGoldenMp4AVTestClient({ mp4Bytes });

        // =====================================================
        // Phase 1 — semantic + structural derivation
        // =====================================================
        prepareTracksForStructuralDerivation({ mp4CompilerState });

        for (const track of mp4CompilerState.tracks) {
            deriveStructuralStateInPlace({ track });
            buildStblChildIntentsWithoutOffsetsInPlace({ track });
        }

        // =====================================================
        // Phase 2 — build STBL with STUB STCO
        // =====================================================
        const stblIntentsStub = mp4CompilerState.tracks.map(track =>
            buildStblIntentFromTrack({ track })
        );

        // =====================================================
        // Phase 3 — build MDAT payload (layout-independent)
        // =====================================================
        mp4CompilerState.mdatPayloadAndChunkLayout = buildMdatPayloadAndChunkLayout({ mp4CompilerState });

        // =====================================================
        // Phase 4 — build MOOV (stub) for SIZE PROBE ONLY
        // =====================================================
        const mvhdIntent = buildMvhdIntentFromCompilerState({ mp4CompilerState });

        const trakIntentsStub = mp4CompilerState.tracks.map((track, index) => {

            const minfIntent = buildMinfIntentFromTrack({
                track: {
                    ...track,
                    storedIntent: { stblIntent: stblIntentsStub[index] }
                }
            });

            const trackForMdia = {
                ...track,
                storedIntent: { minfIntent }
            };

            const mdiaIntent = buildMdiaIntentFromTrack({
                track: trackForMdia
            });

            const mdhd = trackForMdia.storedIntent.mdhd;

            const isVideo = track.semanticTrackFamily === "video";

            return buildTrakIntentFromTrakAndMvhd({
                track: {
                    ...track,
                    storedIntent: {
                        mdiaIntent,
                        mdhd
                    }
                },
                mvhd: mvhdIntent
            });

        });

        const moovStub = composeMoovNode({
            mvhdIntent: mvhdIntent,
            trakIntents: trakIntentsStub,
            udtaIntent: buildUdtaIntentFromBuildHints({
                buildHints: mp4CompilerState.buildHints
            })
        });

        // =====================================================
        // Phase 5 — materialize top-level boxes (pass one)
        // =====================================================
        const topLevelNodes = {
            ftyp: composeFtypNode(),
            free: composeFreeNode(),
            moov: moovStub
        };

        const boxesBeforeMdat = materializePassOneTopLevelBoxes({
                topLevelNodes,
                fileBoxOrder: mp4CompilerState.buildParameters.fileBoxOrder
            });

        const mdatStartOffset = boxesBeforeMdat.reduce((sum, box) => sum + box.byteLength, 0);

        // =====================================================
        // Phase 6 — resolve absolute STCO offsets
        // =====================================================
        const perTrackStcoOffsets = resolveStcoOffsetsPerTrack({
                tracks: mp4CompilerState.tracks,
                mdatChunkLayout:
                    mp4CompilerState.mdatPayloadAndChunkLayout.mdatChunkLayout,
                mdatStartOffset
            });

        const stcoIntents = perTrackStcoOffsets.map(chunkOffsets =>
            adaptStcoIntentFromOffsets({ chunkOffsets })
        );

        // =====================================================
        // Phase 7 — FINAL COMMIT (rebuild EVERYTHING)
        // =====================================================
        const finalTrakIntents = mp4CompilerState.tracks.map((track, index) => {

            const stblIntent =
                buildStblIntentFromTrack({
                    track: {
                        ...track,
                        storedIntent: {
                            ...track.storedIntent,
                            stco: stcoIntents[index]
                        }
                    }
                });

            const minfIntent = buildMinfIntentFromTrack({
                track: {
                    ...track,
                    storedIntent: { stblIntent }
                }
            });

            const trackForMdia = {
                ...track,
                storedIntent: { minfIntent }
            };

            const mdiaIntent = buildMdiaIntentFromTrack({
                track: trackForMdia
            });

            const mdhd = trackForMdia.storedIntent.mdhd;

            const oracleTkhd =
                getGoldenTruthBox
                .getSemanticBoxDataByPathFromMp4File(
                    mp4Bytes,
                    `moov/trak[${index}]/tkhd`
                )
                .readBoxReport()
                .box.fields;


            const isVideo = track.semanticTrackFamily === "video";

            return buildTrakIntentFromTrakAndMvhd({
                track: {
                    ...track,
                    storedIntent: {
                        mdiaIntent,
                        mdhd
                    }
                },
                mvhd: mvhdIntent
            });


        });

        const finalMoovBytes = serializeBoxTree(
            composeMoovNode({
                mvhdIntent: mvhdIntent,
                trakIntents: finalTrakIntents,
                udtaIntent: buildUdtaIntentFromBuildHints({
                    buildHints: mp4CompilerState.buildHints
                })
            })
        );

        // =====================================================
        // Oracle MOOV
        // =====================================================
        const oracleMoovBytes =
            getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4Bytes,
                "moov"
            )
            .readBoxReport()
            .raw;

        // =====================================================
        // Assertion — byte-for-byte
        // =====================================================
        const diffs = [];
        const byteCount =
            Math.max(finalMoovBytes.length, oracleMoovBytes.length);

        for (let i = 0; i < byteCount; i++) {
            assertEqualHexCollect(
                diffs,
                `${fixture}: moov.byte[${i}]`,
                finalMoovBytes[i],
                oracleMoovBytes[i]
            );
        }

        if (diffs.length) {
            console.table(diffs.slice(0, 50));
            throw new Error(
                `${fixture}: MOOV mismatch (${diffs.length} bytes differ)`
            );
        }
    }
}

