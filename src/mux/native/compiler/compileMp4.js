import { normalizeAccessUnitsInPlace } from "../normalization/access-units/index.js";
import { deriveStructuralStateInPlace } from "../derivers/deriveStructuralStateInPlace.js";
import { deriveSemanticTrackFamily } from "../derivers/deriveSemanticTrackFamily.js";
import {
    applyAvcCContainerPolicySemantic,
    applyAvcCContainerPolicyContainerComplete,
} from "../policies/applyAvcCContainerPolicy.js";
import { applyBtrtContainerPolicy } from "../policies/applyBtrtContainerPolicy.js";
import { applyPaspContainerPolicy } from "../policies/applyPaspContainerPolicy.js";
import { applyTrackHandlerPolicy } from "../policies/applyTrackHandlerPolicy.js";
import { applyTrackHeaderPolicy } from "../policies/applyTrackHeaderPolicy.js";
import { adaptCodecConfigurationToStsdParams } from "../adapters/adaptCodecConfigurationToStsdParams.js";
import { adaptAudioCodecConfigurationToStsdParams } from "../adapters/adaptAudioCodecConfigurationToStsdParams.js";
import { adaptStcoIntentFromOffsets } from "../adapters/adaptStcoIntentFromOffsets.js";
import { buildMdatPayloadAndChunkLayout } from "../mdat/buildMdatPayloadAndChunkLayout.js";
import { resolvePhysicalLayout } from "../resolvePhysicalLayout.js";
import { emitMp4FileFromResolvedParts } from "../emitMp4FileFromResolvedParts.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
import { parseAudioSpecificConfigFromEsds } from "../codec-introspection/mp4a/parseAudioSpecificConfigFromEsds.js";
import { buildStblChildIntentsWithoutOffsetsInPlace } from "../builders/buildStblChildIntentsWithoutOffsetsInPlace.js";
import { buildMvhdIntentFromCompilerState } from "../builders/buildMvhdIntentFromCompilerState.js";
import { buildMinfIntentFromTrack } from "../builders/buildMinfIntentFromTrack.js";
import { buildMdiaIntentFromTrack } from "../builders/buildMdiaIntentFromTrack.js";
import { buildTrakIntentFromTrakAndMvhd } from "../builders/buildTrakIntentFromTrakAndMvhd.js";
import { buildUdtaIntentFromBuildHints } from "../builders/buildUdtaIntentFromBuildHints.js";
import { buildStblIntentFromTrack } from "../builders/buildStblIntentFromTrack.js";
import { composeMoovNode } from "../composers/composeMoovNode.js";
import { composeFtypNode } from "../composers/composeFtypNode.js";
import { composeFreeNode } from "../composers/composeFreeNode.js";
import { materializePassOneTopLevelBoxes } from "../layout/materializePassOneTopLevelBoxes.js";
import { resolveStcoOffsetsPerTrack } from "../layout/resolveStcoOffsetsPerTrack.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";

import { getGoldenTruthBox } from "../tests/goldenTruthExtractors/index.js";

import { validatePacketTopologyAdmissibility } from "../compiler/validateCompilerAdmissibility.js";

// INTERNAL: compiler implementation detail — use createMp4FromInputs() instead
/**
 * compileMp4
 * =============================
 *
 * INTERNAL PRODUCTION ENTRY POINT
 *
 * This function represents the canonical NativeMuxer compilation pipeline.
 *
 * All future source adapters (WebCodecs, MP4 demux, image sequences, etc.)
 * are expected to produce semantic inputs compatible with this function.
 *
 * Lower-level utilities (e.g. emitMp4FileFromResolvedParts) are implementation details.
 *
 * Assembles a complete MP4 file from frozen semantic inputs using the
 * NativeMuxer production pipeline.
 *
 * ---------------------------------------------------------------------------
 * Architectural Intent
 * ---------------------------------------------------------------------------
 *
 * This function is intentionally structured using a **hybrid layout**:
 *
 *   - PRIMARY AXIS: Architectural tiers (compiler pipeline)
 *   - SECONDARY AXIS: MP4 box responsibility within each tier
 *
 * The goal is to make *data flow* explicit while still allowing a reader
 * to reason locally about each MP4 box.
 *
 * This is a compiler-style assembly, not a builder-style assembly.
 *
 * ---------------------------------------------------------------------------
 * The Tiers
 * ---------------------------------------------------------------------------
 *
 * Tier 1 — Semantic Media Facts (Normalization)
 * ---------------------------------------------
 * Canonicalization of intrinsic media truths.
 *
 * This tier takes valid input and normalizes it into a complete,
 * internally consistent semantic model required by downstream stages.
 *
 * Normalization may:
 *   - assert and enforce invariants
 *   - fill required fields with the only valid value
 *   - make implicit facts explicit
 *
 * Normalization must NOT:
 *   - choose between multiple valid outcomes
 *   - apply container compatibility rules
 *   - derive structural layout
 *
 * Examples of normalized facts:
 *   - access units and their payloads
 *   - timestamps, durations, keyframes
 *   - codec identity and configuration
 *   - single sample description invariants
 *   - track- and movie-level timing metadata
 *
 * After this tier, downstream code must not ask:
 *   “is this present?” or “which one should I pick?”
 *
 * Tier 2 — Structural Derivation
 * ------------------------------
 * Deterministic structure derived from semantics:
 *   - chunk topology
 *   - sample grouping
 *   - sample numbering
 *   - track duration
 *
 * Tier 3 — Adaptation
 * -------------------
* Shape translation from derived data into emitter-ready parameters.
* No policy, no compatibility decisions.
*
* Tier 4 — Container Policies
* ---------------------------
* Explicit, named container-level decisions that are:
*   - not semantic
*   - not derivable
*   - required for compatibility
*
* Tier 5 — Emission + Assembly
* ----------------------------
* Box emission, physical layout resolution, and final byte assembly.
*
    * ---------------------------------------------------------------------------
* Design Rules (Hard)
    * ---------------------------------------------------------------------------
    *
    * - No tier may reach "backward" to an earlier tier
    * - Policies must not be hidden inside adapters or emitters
    * - Emitters must be pure serializers
    * - This function defines *order*, not algorithms
    *
    * The structure here is deliberate and pedagogical.
    * Extraction into sub-functions will preserve tier boundaries.
    * 
    * compileMp4 assumes a validated Mp4BuildInput
    */
export function compileMp4({ mp4CompilerState }) {

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
    const mvhdIntent = buildMvhdIntentFromCompilerState({ mp4CompilerState });

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

    const ftypNode = composeFtypNode();
    const freeNode = composeFreeNode();

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

    const topLevelByType = {
        ftyp: ftypNode,
        free: freeNode,
        moov: finalMoovNode,
        mdat: mdatNode
    };

    const orderedTopLevelNodes =
        mp4CompilerState.buildParameters.fileBoxOrder.map(
            type => topLevelByType[type]
        );

    const parts =
        orderedTopLevelNodes.map(node => serializeBoxTree(node));

    const totalSize =
        parts.reduce((sum, bytes) => sum + bytes.length, 0);

    const bytes = new Uint8Array(totalSize);

    let offset = 0;
    for (const part of parts) {
        bytes.set(part, offset);
        offset += part.length;
    }

    return bytes;
}

/**
 *   Tier 1 — Semantic Media Facts (Normalization)
 *
 * Canonicalizes Mp4BuildInput into a complete, internally consistent form
 * required by the NativeMuxer compilation pipeline.
 *
 * -------------------------------------------------------------------------
 * Purpose
 * -------------------------------------------------------------------------
 *
 * Normalization exists to make downstream stages *boring*.
 *
 * After normalization:
 *   - all required fields are present
 *   - all invariants are enforced
 *   - any value with only ONE valid outcome is made explicit
 *
 * Downstream code must never need to ask:
 *   - “is this present?”
 *   - “which value should I choose?”
 *
 * -------------------------------------------------------------------------
 * What normalization IS
 * -------------------------------------------------------------------------
 *
 * Normalization:
 *   - enforces intrinsic media invariants
 *   - fills in required values when only one valid value exists
 *   - makes implicit facts explicit
 *
 * Normalization may:
 *   - assert constraints
 *   - copy, annotate, or reshape data
 *   - attach deterministic, unavoidable values
 *
 * -------------------------------------------------------------------------
 * What normalization is NOT
 * -------------------------------------------------------------------------
 *
 * Normalization must NOT:
 *   - choose between multiple valid outcomes
 *   - apply container compatibility rules
 *   - derive structural layout (chunks, tables, topology)
 *   - encode MP4 box representation
 *
 * If a decision has more than one valid answer:
 *   - it does NOT belong here
 *   - it is either a derivation strategy or a container policy
 *
 * -------------------------------------------------------------------------
 * Current invariants enforced
 * -------------------------------------------------------------------------
 *
 * At the current maturity of the system:
 *
 *   - exactly ONE sample description per track is supported
 *   - therefore, all samples MUST reference sampleDescriptionIndex = 1
 *
 * This is NOT a policy or a preference.
 * It is the only value that can produce a valid MP4 under current constraints.
 *
 * If multi-sample-description tracks are ever supported,
 * this normalization MUST be revisited.
 *
 */
export function prepareTracksForStructuralDerivation({ mp4CompilerState }) {

    if (!mp4CompilerState.buildParameters) {
        mp4CompilerState.buildParameters = {};
    }

    if (!mp4CompilerState.buildParameters.fileBoxOrder) {
        mp4CompilerState.buildParameters.fileBoxOrder = [ "ftyp", "free", "mdat", "moov" ];
    }

    // Initialise top-level node storage
    mp4CompilerState.storedTopLevelNodes = {};

    mp4CompilerState.highestTrackId = 0;
    for (const track of mp4CompilerState.tracks) {
        mp4CompilerState.highestTrackId++;
        track.trackId = mp4CompilerState.highestTrackId;
        if (track.semanticCore.codec.codec == "opus") {
            mp4CompilerState.buildParameters.fileBoxOrder = [ "ftyp", "moov", "free", "mdat" ];
        }
    }

    for (const track of mp4CompilerState.tracks) {
        // test: testNativeMuxer_DeriveSemanticTrackFamily
        track.semanticTrackFamily = deriveSemanticTrackFamily(track);
    }

    for (const [index, track] of mp4CompilerState.tracks.entries()) {
        validatePacketTopologyAdmissibility(track, index);
    }


    for (const track of mp4CompilerState.tracks) {


        /**
         * Normalizes access units into a compiler-ready form.
         *
         * Guarantees:
         * - each access unit has a derived `duration` (computed from PTS adjacency)
         * - each access unit has `sampleDescriptionIndex = 1`
         *
         * Notes:
         * - WebCodecs provides PTS, not duration
         * - all outcomes here are single-valid and non-policy decisions
         *
         *  test: testNativeMuxer_NormalizeAccessUnitsInPlace_WebCodecs
         */
        normalizeAccessUnitsInPlace({ accessUnits: track.semanticCore.accessUnits, codec: track.semanticCore.codec.codec });
    }

    for (const track of mp4CompilerState.tracks) {

        // test: testNativeMuxer_TrackDuration_Relationships_AllFixtures
        track.trackDuration = getSumOfAccessUnitDurations(track.semanticCore.accessUnits);
    }

    for (const track of mp4CompilerState.tracks) {
        if (track.semanticCore.codec.codec === "opus" &&
            track.semanticCore.codec.esds !== undefined) {
            throw new Error("Opus must not provide esds; use dOps instead");
        }
    }

    for (const track of mp4CompilerState.tracks) {
        track.storedIntent = {}
    }

    mp4CompilerState.storedIntent = {};
}

export function getSumOfAccessUnitDurations(accessUnits) {

        if (!accessUnits) {
            throw new Error( "getSumOfAccessUnitDurations: accessUnits is required");
        }
        if (!Array.isArray(accessUnits)) {
            throw new Error( "getSumOfAccessUnitDurations: accessUnits must be an array");
        }

        if (accessUnits.length === 0) {
            return 0;
        }

        let totalDuration = 0;

        for (const accessUnit of accessUnits) {

            if (!Number.isInteger(accessUnit.duration)) {
                throw new Error("getSumOfAccessUnitDurations: accessUnit.duration must be an integer");
            }

            totalDuration += accessUnit.duration;
        }

        return totalDuration;
}
