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

import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
import { emitMp4FileFromResolvedParts } from "../emitMp4FileFromResolvedParts.js";

import { runGoldenMp4AVTestClient } from "./clients/goldenMp4AVSourceClient.js";

export async function testNativeMuxer_MP4_FromResolvedParts_Equals_FFmpegOracle() {

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

            // -------------------------------------------------
            // Load oracle
            // -------------------------------------------------
            const resp = await fetch(fixture);
            const oracleBytes = new Uint8Array(await resp.arrayBuffer());

            const mp4CompilerState =
                await runGoldenMp4AVTestClient({ mp4Bytes: oracleBytes });

            // -------------------------------------------------
            // Phase 1 — normalization + derivation
            // -------------------------------------------------
            prepareTracksForStructuralDerivation({ mp4CompilerState });

            for (const track of mp4CompilerState.tracks) {
                deriveStructuralStateInPlace({ track });
                buildStblChildIntentsWithoutOffsetsInPlace({ track });
            }

            // -------------------------------------------------
            // Phase 2 — stub STBL
            // -------------------------------------------------
            const stblStubIntents =
                mp4CompilerState.tracks.map(track =>
                    buildStblIntentFromTrack({ track })
                );

            // -------------------------------------------------
            // Phase 3 — MDAT payload
            // -------------------------------------------------
            mp4CompilerState.mdatPayloadAndChunkLayout =
                buildMdatPayloadAndChunkLayout({ mp4CompilerState });

            // -------------------------------------------------
            // Phase 4 — MOOV stub
            // -------------------------------------------------
            const mvhdIntent =
                buildMvhdIntentFromCompilerState({ mp4CompilerState });

            const trakStubIntents =
                mp4CompilerState.tracks.map((track, index) => {

                    const minfIntent =
                        buildMinfIntentFromTrack({
                            track: {
                                ...track,
                                storedIntent: { stblIntent: stblStubIntents[index] }
                            }
                        });

                    const mdiaIntent =
                        buildMdiaIntentFromTrack({
                            track: {
                                ...track,
                                storedIntent: { minfIntent }
                            }
                        });

                    return buildTrakIntentFromTrakAndMvhd({
                        track: {
                            ...track,
                            storedIntent: {
                                mdiaIntent,
                                mdhd: mdiaIntent.mdhd
                            }
                        },
                        mvhd: mvhdIntent
                    });
                });

            const moovStub =
                composeMoovNode({
                    mvhdIntent,
                    trakIntents: trakStubIntents,
                    udtaIntent:
                        buildUdtaIntentFromBuildHints({
                            buildHints: mp4CompilerState.buildHints
                        })
                });

            // -------------------------------------------------
            // Phase 5 — pass-one materialization
            // -------------------------------------------------
            const ftypNode = composeFtypNode();

            const oracleFtyp =
                getGoldenTruthBox
                .getSemanticBoxDataByPathFromMp4File(
                    oracleBytes,
                    "ftyp"
                )
                .readBoxReport()
                .raw;

            const compilerFtyp =
                serializeBoxTree(ftypNode);

            console.log("ORACLE FTYP:", [...oracleFtyp]);
            console.log("COMPILER FTYP:", [...compilerFtyp]);

            const oracleFreeSize =
                getGoldenTruthBox
                .getSemanticBoxDataByPathFromMp4File(
                    oracleBytes,
                    "free"
                )
                .readBoxReport()
                .raw.length;

            const freePayloadSize = oracleFreeSize - 8;

            const freeNode = {
                type: "free",
                body:
                freePayloadSize === 0
                ? []
                : new Uint8Array(freePayloadSize)
            };

            const oracleFree =
                getGoldenTruthBox
                .getSemanticBoxDataByPathFromMp4File(
                    oracleBytes,
                    "free"
                )
                .readBoxReport()
                .raw;

            const compilerFree =
                serializeBoxTree(freeNode);

            console.log("ORACLE FREE:", [...oracleFree]);
            console.log("COMPILER FREE:", [...compilerFree]);

            const boxesBeforeMdat =
                materializePassOneTopLevelBoxes({
                    topLevelNodes: {
                        ftyp: ftypNode,
                        free: freeNode,
                        moov: moovStub
                    },
                    fileBoxOrder:
                        mp4CompilerState.buildParameters.fileBoxOrder
                });

            const mdatStartOffset =
                boxesBeforeMdat.reduce(
                    (sum, b) => sum + b.byteLength,
                    0
                );

            // -------------------------------------------------
            // Phase 6 — resolve STCO
            // -------------------------------------------------
            const perTrackStcoOffsets =
                resolveStcoOffsetsPerTrack({
                    tracks: mp4CompilerState.tracks,
                    mdatChunkLayout:
                        mp4CompilerState.mdatPayloadAndChunkLayout.mdatChunkLayout,
                    mdatStartOffset
                });

            const stcoIntents =
                perTrackStcoOffsets.map(chunkOffsets =>
                    adaptStcoIntentFromOffsets({ chunkOffsets })
                );

            // -------------------------------------------------
            // Phase 7 — FINAL rebuild
            // -------------------------------------------------
            const finalTrakIntents =
                mp4CompilerState.tracks.map((track, index) => {

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

                    const minfIntent =
                        buildMinfIntentFromTrack({
                            track: {
                                ...track,
                                storedIntent: { stblIntent }
                            }
                        });

                    const mdiaIntent =
                        buildMdiaIntentFromTrack({
                            track: {
                                ...track,
                                storedIntent: { minfIntent }
                            }
                        });

                    return buildTrakIntentFromTrakAndMvhd({
                        track: {
                            ...track,
                            storedIntent: {
                                mdiaIntent,
                                mdhd: mdiaIntent.mdhd
                            }
                        },
                        mvhd: mvhdIntent
                    });
                });

            const finalMoovNode =
                composeMoovNode({
                    mvhdIntent,
                    trakIntents: finalTrakIntents,
                    udtaIntent:
                        buildUdtaIntentFromBuildHints({
                            buildHints: mp4CompilerState.buildHints
                        })
                });

            // -------------------------------------------------
            // Phase 8 — FINAL emission
            // -------------------------------------------------
            const mdatNode =
                EmitterRegistry.emit(
                    "mdat",
                    {
                        payload:
                            mp4CompilerState.mdatPayloadAndChunkLayout.mdatPayload
                    }
                );


            const oracleMdatBytes =
                getGoldenTruthBox
                .getSemanticBoxDataByPathFromMp4File(
                    oracleBytes,
                    "mdat"
                )
                .readBoxReport()
                .raw;

            const compilerMdatBytes =
                serializeBoxTree(mdatNode);

            console.log("ORACLE MDAT length:", oracleMdatBytes.length);
            console.log("COMPILER MDAT length:", compilerMdatBytes.length);


            const topLevelByType = {
                ftyp: ftypNode,
                free: freeNode,
                moov: finalMoovNode,
                mdat: mdatNode
            };

            // -------------------------------------------------
            // Serialize top-level boxes and concatenate
            // -------------------------------------------------
            const orderedTopLevelNodes = mp4CompilerState.buildParameters.fileBoxOrder.map(
                    type => topLevelByType[type]
                );

            const parts =
                orderedTopLevelNodes.map(node => serializeBoxTree(node));

            const totalSize =
                parts.reduce((sum, bytes) => sum + bytes.length, 0);

            const compilerBytes = new Uint8Array(totalSize);

            let offset = 0;
            for (const bytes of parts) {
                compilerBytes.set(bytes, offset);
                offset += bytes.length;
            }

            // -------------------------------------------------
            // Optional download (manual inspection)
            // -------------------------------------------------
            if (window.DEBUG_DOWNLOAD_MP4 === true) {
                const safeName = fixture.split("/").pop().replace(".mp4", "");
                const filename = `${safeName}-native.mp4`;
                console.log("[DEBUG] Downloading", filename);
                downloadMp4(compilerBytes, filename);
            }

            // -------------------------------------------------
            // Assertion
            // -------------------------------------------------
            const diffs = [];
            const max = Math.max(compilerBytes.length, oracleBytes.length);

            for (let i = 0; i < max; i++) {
                assertEqualHexCollect(
                    diffs,
                    `${fixture}: mp4.byte[${i}]`,
                    compilerBytes[i],
                    oracleBytes[i]
                );
            }

            if (diffs.length) {
                console.table(diffs.slice(0, 50));
                throw new Error(`MP4 mismatch (${diffs.length} bytes differ)`);
            }

            console.log(`PASS: ${fixture}`);

        } catch (err) {
            failures.push({ fixture, error: err });
            console.error("MP4 build failed:", err);
        }
    }

    if (failures.length) {
        throw new Error(
            `MP4 mismatch: ${failures.length} failing case(s)`
        );
    }
}

function downloadMp4(bytes, filename) {
    const blob = new Blob([bytes], { type: "video/mp4" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
