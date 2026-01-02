import {
    runGoldenMp4TestClient
} from "./clients/goldenMp4SourceClient.js";

import { normalizeAccessUnitsInPlace } from "../normalization/access-units/index.js";
import { deriveChunkModel } from "../derivers/deriveChunkModel.js";
import { deriveStscEntries } from "../derivers/deriveStscEntries.js";
import { deriveTrackDuration } from "../derivers/deriveTrackDuration.js";
import { deriveStssSampleNumbers } from "../derivers/deriveStssSampleNumbers.js";
import { deriveDecodeTimestampsInPlace } from "../derivers/deriveDecodeTimestampsInPlace.js";
import { DecodeOrderStrategies} from "../derivers/strategies/decodeOrderStrategies.js";
import { assembleMdatPayloadFromChunks } from "../assembleMdatPayloadFromChunks.js";
import { resolvePhysicalLayout } from "../resolvePhysicalLayout.js";
import { commitMoovWithResolvedLayout } from "../commit/commitMoovWithResolvedLayout.js";
import { emitMp4FileFromResolvedParts } from "../emitMp4FileFromResolvedParts.js";

import { emitFtypBox } from "../box-emitters/ftypBox.js";
import { emitMoovBox } from "../box-emitters/moovBox.js";
import { emitMvhdBox } from "../box-emitters/mvhdBox.js";
import { emitTrakBox } from "../box-emitters/trakBox.js";
import { emitMdiaBox } from "../box-emitters/mdiaBox.js";
import { emitMinfBox } from "../box-emitters/minfBox.js";
import { emitStblBox } from "../box-emitters/stblBox.js";
import { emitVmhdBox } from "../box-emitters/vmhdBox.js";
import { emitDinfBox } from "../box-emitters/dinfBox.js";
import { emitDrefBox } from "../box-emitters/drefBox.js";
import { emitMdhdBox } from "../box-emitters/mdhdBox.js";
import { emitHdlrBox } from "../box-emitters/hdlrBox.js";
import { emitTkhdBox } from "../box-emitters/tkhdBox.js";
import { emitStsdBox } from "../box-emitters/stsdBox.js";
import { emitSttsBox } from "../box-emitters/sttsBox.js";
import { emitCttsBox } from "../box-emitters/cttsBox.js";
import { emitStscBox } from "../box-emitters/stscBox.js";
import { emitStszBox } from "../box-emitters/stszBox.js";
import { emitStcoBox } from "../box-emitters/stcoBox.js";
import { emitUdtaBox } from "../box-emitters/udtaBox.js";
import { emitStssBox } from "../box-emitters/stssBox.js";
import { emitEdtsBox } from "../box-emitters/edtsBox.js";
import { emitElstBox } from "../box-emitters/elstBox.js";

import { adaptSttsFromSamples } from "../adapters/adaptSttsFromSamples.js";

import { deriveStszSizesFromPayloads } from "../derivers/deriveStszSizesFromPayloads.js";

import { adaptCttsFromSamples } from "../adapters/adaptCttsFromSamples.js";
import { adaptStscEntriesToEmitterParams } from "../adapters/adaptStscEntriesToEmitterParams.js";
import { adaptCodecConfigurationToStsdParams } from "../adapters/adaptCodecConfigurationToStsdParams.js";

import { asContainer } from "../box-model/Box.js";
import {
    readUint32,
    readFourCC
} from "../bytes/mp4ByteReader.js";
import { describeMp4Byte } from "./reference/Mp4ByteContext.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

import {
    extractBoxByPathFromMp4,
    extractChildBoxFromContainer,
} from "./reference/BoxExtractor.js";

import {
    assertEqual,
    assertExists,
    assertEqualHex,
} from "./assertions.js";

import { validateMp4BuildInput }
    from "../validateMp4BuildInput.js";

import { applyAvcCContainerPolicy }
    from "../policies/applyAvcCContainerPolicy.js";

import { applyBtrtContainerPolicy }
    from "../policies/applyBtrtContainerPolicy.js";

import { applyTrackHandlerPolicy }
    from "../policies/applyTrackHandlerPolicy.js";

import { applyMovieTimingPolicy }
    from "../policies/applyMovieTimingPolicy.js";

import { applyEditListPolicy }
    from "../policies/applyEditListPolicy.js";

import { applyTrackHeaderPolicy }
    from "../policies/applyTrackHeaderPolicy.js";

import { applyCompressorNamePolicy }
    from "../policies/applyCompressorNamePolicy.js";

import { applyUdtaPolicy }
    from "../policies/applyUdtaPolicy.js";

/**
 * End-to-end NativeMuxer conformance from frozen semantic fixtures.
 *
 * This file intentionally contains TWO tests that share the same
 * assembly pipeline but apply different correctness contracts.
 *
 * The distinction is fundamental.
 *
 * ---------------------------------------------------------------------------
 * The Three Tiers of MP4 Construction
 * ---------------------------------------------------------------------------
 *
 * Producing a real, usable MP4 requires THREE distinct categories of input.
 * Conflating them leads to dishonest tests and fragile architecture.
 *
 * Tier 1 — Semantic Media Facts
 * -----------------------------
 * These are facts that are intrinsic to the media itself.
 * They are true regardless of encoder, container, or tooling.
 *
 * Examples:
 *   - access unit bytes
 *   - presentation timestamps (PTS)
 *   - sample durations
 *   - keyframe markers (isKey)
 *   - codec identity (avc1, profile/level, SPS/PPS)
 *   - track and movie timescales
 *
 * Tier 1 answers the question:
 *   “What happened in time, and what bytes must be decoded?”
 *
 * The frozen semantic fixtures supply Tier 1.
 *
 *
 * Tier 2 — Container Policy Decisions
 * -----------------------------------
 * These are decisions required in practice to produce a widely-compatible,
 * inspectable, standards-conformant MP4, but which are NOT derivable from
 * semantic media facts alone.
 *
 * Examples:
 *   - exact SampleEntry defaults in stsd
 *   - presence and structure of optional-but-important boxes
 *   - default field values chosen by encoders (ffmpeg, MP4Box, etc.)
 *   - compatibility envelope decisions
 *
 * Two MP4 producers given the same Tier 1 semantics may legally choose
 * different Tier 2 values.
 *
 * Tier 2 answers the question:
 *   “What kind of MP4 do we emit by default?”
 *
 * In this codebase, Tier 2 is made EXPLICIT in the assembler.
 * It is not hidden in emitters, tests, or fixtures.
 *
 *
 * Tier 3 — Physical Layout Resolution
 * -----------------------------------
 * These are mechanical consequences of assembling the final file.
 *
 * Examples:
 *   - chunk offsets (stco)
 *   - box sizes
 *   - final byte positions
 *
 * Tier 3 answers the question:
 *   “Where do these bytes end up in the file?”
 *
 * Tier 3 is resolved only after full assembly and layout.
 *
 *
 * ---------------------------------------------------------------------------
 * Why There Are Two Tests In This File
 * ---------------------------------------------------------------------------
 *
 * TEST A — Semantic Canonical Assembly
 * -----------------------------------
 * Asserts that Tier 1 semantics PLUS explicit Tier 2 policy decisions
 * are SUFFICIENT to reproduce all MP4 bytes that are semantically
 * and policy-determined.
 *
 * This test intentionally DOES NOT assert full byte-for-byte equivalence
 * with the oracle MP4, because certain representational details are not
 * present in the semantic fixtures.
 *
 * Any mismatch outside the explicitly-declared exceptions is a HARD FAILURE.
 *
 *
 * TEST B — Oracle Fidelity
 * -----------------------
 * Supplies the missing representational inputs extracted from the oracle
 * MP4 (ffmpeg output), thereby providing Tier 1 + Tier 2 in full.
 *
 * This test asserts COMPLETE byte-for-byte equivalence.
 *
 * If this test fails, the compiler is incorrect.
 *
 *
 * These guarantees are different.
 * They must never be conflated.
 */

/**
 * createMp4FromInputs
 * ===================
 *
 * Public compiler entry point.
 *
 * This function is the ONLY supported way to invoke the NativeMuxer compiler.
 *
 * This doc block is the AUTHORITATIVE CONTRACT for the Mp4BuildInput shape.
 * Adapters, tests, and internal compiler phases MUST conform to what is
 * documented here. They may enforce it, but MUST NOT redefine it.
 *
 * createMp4FromInputs
 * ===================
 *
 * SEMANTIC FREEZE NOTICE
 * ----------------------
 * The Mp4BuildInput semantics consumed by this function are FROZEN.
 *
 * Any change to:
 * - Mp4BuildInput shape
 * - semanticCore meaning
 * - buildParameters meaning
 * - buildHints interpretation
 *
 * requires a test that proves the necessity of the change.
 *
 * No refactors, cleanups, or generalizations are permitted without
 * a failing test that demonstrates incorrect behavior.
 *
 * -------------------------------------------------------------------------
 * Purpose
 * -------------------------------------------------------------------------
 *
 * Takes a validated Mp4BuildInput and produces a complete, playable MP4 file
 * as a byte array.
 *
 *   Mp4BuildInput → Uint8Array (MP4 file bytes)
 *
 * This function defines the integration boundary between:
 *   - application code (source adapters, fixtures, real apps)
 *   - and the NativeMuxer compiler
 *
 * -------------------------------------------------------------------------
 * Ownership & Mutability Contract
 * -------------------------------------------------------------------------
 *
 * Calling this function transfers ownership of `mp4BuildInput` to the compiler.
 *
 * From this point forward:
 *
 *   - the compiler MAY mutate the object in place
 *   - the caller MUST NOT read from or write to it again
 *
 * This is a deliberate performance tradeoff.
 *
 * JavaScript does not provide a practical way to enforce immutability here
 * without duplicating large payloads.
 *
 * This rule is enforced by:
 *   - architectural convention
 *   - adapter structure
 *   - validation guards
 *   - tests
 *   - and this documentation
 *
 * -------------------------------------------------------------------------
 * Mp4BuildInput — Authoritative Shape
 * -------------------------------------------------------------------------
 *
 * Mp4BuildInput intentionally separates FOUR categories of information.
 * No field may cross these boundaries.
 *
 * ---------------------------------------------------------
 * 1. Semantic media facts (encoder-emitted truths)
 * ---------------------------------------------------------
 *
 * semanticCore: {
 *   accessUnits: Array<{
 *     pts: number        // presentation timestamp (encoder-emitted)
 *     isKey: boolean     // sync sample flag (encoder-emitted)
 *   }>
 *
 * Codec Configuration — avcCCompleteness
 * -------------------------------------
 *
 * The `avcCCompleteness` field describes the *authority* of the provided
 * AVCDecoderConfigurationRecord (`avcC`).
 *
 * It answers a critical question:
 *
 *   “Are these avcC bytes already a complete, container-level decision,
 *    or are they only the raw codec configuration emitted by an encoder?”
 *
 * This distinction matters because the NativeMuxer supports two very
 * different use cases:
 *
 *   1. Producing a playable MP4 from encoder output (e.g. WebCodecs)
 *   2. Transmuxing or reproducing an existing MP4 without altering history
 *
 * The muxer must know whether it is allowed to *complete* avcC, or whether
 * it must *preserve it exactly as given*.
 *
 * ---------------------------------------------------------------------
 * Values
 * ---------------------------------------------------------------------
 *
 *   avcCCompleteness: "semantic"
 *
 *     Indicates that `avcC` contains only the semantic codec configuration
 *     emitted by an encoder.
 *
 *     This is typical for encoder APIs such as WebCodecs, which provide
 *     SPS/PPS and profile information, but do not claim MP4 container
 *     completeness.
 *
 *     When `avcCCompleteness` is "semantic":
 *       - The muxer is allowed to apply container-level policy
 *       - Missing MP4-required fields may be added deterministically
 *       - The goal is broad decoder compatibility and playability
 *
 *     Use this when:
 *       - Adapting WebCodecs output
 *       - Adapting raw encoder output
 *       - There is no existing container history to preserve
 *
 *
 *   avcCCompleteness: "container-complete"
 *
 *     Indicates that `avcC` was extracted from an existing MP4 container
 *     and already reflects a complete container-level decision.
 *
 *     In this case, the bytes represent *historical fact*, not a suggestion.
 *     The muxer must preserve them exactly and must not attempt to complete,
 *     extend, or reinterpret them.
 *
 *     When `avcCCompleteness` is "container-complete":
 *       - No container completion policy is applied
 *       - avcC bytes are emitted verbatim
 *       - The goal is fidelity, not improvement
 *
 *     Use this when:
 *       - Transmuxing from an existing MP4 file
 *       - Reproducing or comparing container output
 *       - Maintaining the historical encoding and container decisions
 *
 * ---------------------------------------------------------------------
 * Why this field exists
 * ---------------------------------------------------------------------
 *
 * Without this explicit declaration, the muxer would be forced to guess:
 * inspecting byte lengths, profiles, or encoder behavior.
 *
 * Guessing is not acceptable.
 *
 * By making avcC authority explicit:
 *   - Adapters remain honest about what they received
 *   - Policies remain simple and deterministic
 *   - Transmuxing and encoding pipelines can coexist safely
 *
 * This field prevents accidental double-application of container policy
 * and makes encoder intent explicit at the system boundary.
 *
 * ---------------------------------------------------------------------
 * Responsibility
 * ---------------------------------------------------------------------
 *
 * - Source adapters MUST set `avcCCompleteness` explicitly.
 * - Policies MUST NOT infer completeness from avcC bytes.
 * - Missing or ambiguous completeness MUST fail loudly.
 *
 *   codec: {
 *     codec: string      // RFC 6381 codec string (e.g. "avc1.42E01E")
 *     avcC: Uint8Array  // raw AVCDecoderConfigurationRecord bytes
 *   }
 * }
 *
 * Rules:
 * - semanticCore contains ONLY facts directly emitted or unambiguously
 *   observable from the encoder
 * - semanticCore MUST NOT contain container policy, defaults, or guesses
 * - semanticCore MUST NOT require SPS parsing or MP4 knowledge
 *
 * ---------------------------------------------------------
 * 2. Encoded media payloads (opaque bytes only)
 * ---------------------------------------------------------
 *
 * payloads: {
 *   accessUnitPayloads: Uint8Array[]
 * }
 *
 * Rules:
 * - payload bytes are opaque to the compiler
 * - payloads contain NO semantic interpretation
 * - accessUnits and accessUnitPayloads are positionally aligned
 *
 * ---------------------------------------------------------
 * 3. Required build parameters (application-owned)
 * ---------------------------------------------------------
 *
 * buildParameters: {
 *   codedWidth: number
 *   codedHeight: number
 *   trackTimescale: number
 * }
 *
 * Rules:
 * - these values are NOT semantic media facts
 * - they are REQUIRED to produce a valid MP4
 * - they are OWNED by the application
 * - they are NEVER defaulted
 * - missing required buildParameters is a HARD ERROR
 *
 * ---------------------------------------------------------
 * 4. Optional build hints (explicit, ignorable intent)
 * ---------------------------------------------------------
 *
 * buildHints?: {
 *
 *   // -------------------------------------------------------------------
 *   // Bitrate signaling (optional, non-semantic)
 *   // -------------------------------------------------------------------
 *
 *   btrt?: {
 *     bufferSizeDB: number
 *     maxBitrate:   number
 *     avgBitrate:   number
 *   }
 *
 *   NOTE ON btrt:
 *   -------------
 *   The Bitrate Box (btrt) is NOT a semantic media fact.
 *   Multiple valid btrt representations may exist for the same video.
 *
 *   If btrt values are supplied via buildHints, they MUST reflect the
 *   encoder configuration used by the application.
 *
 *   If btrt is required by a selected container policy and is missing,
 *   the compiler MUST fail loudly.
 *
 *   The compiler will NOT:
 *     - invent btrt values
 *     - derive them from access units
 *     - guess encoder state
 *
 *
 *   // -------------------------------------------------------------------
 *   // Opaque container history (transmuxing)
 *   // -------------------------------------------------------------------
 *
 *   udtaBytes?: Uint8Array
 *
 *     Opaque, container-complete `udta` box bytes.
 *
 *     This field exists to support transmuxing and historical preservation.
 *
 *     When provided:
 *       - the entire `udta` box is treated as authoritative
 *       - no interpretation is performed
 *       - no defaults are applied
 *       - bytes are preserved verbatim
 *
 *     This input represents *historical fact*, not preference.
 *
 *
 *   // -------------------------------------------------------------------
 *   // Semantic encoder attribution (new authorship)
 *   // -------------------------------------------------------------------
 *
 *   encoderIdentity?: string
 *
 *     A semantic declaration of encoder authorship.
 *
 *     This is NOT a raw container field.
 *     It expresses *intent* about who authored the produced MP4.
 *
 *     This value may be used by container policy to construct metadata
 *     (e.g. within `udta/meta/ilst`) according to project defaults.
 *
 *     This input represents *new authorship*, not preserved history.
 *
 *
 *   // -------------------------------------------------------------------
 *   // Mutual exclusivity (grammar rule)
 *   // -------------------------------------------------------------------
 *
 *   `udtaBytes` and `encoderIdentity` MUST NOT both be present.
 *
 *     - `udtaBytes` preserves existing history
 *     - `encoderIdentity` declares new history
 *
 *   Providing both would create conflicting provenance.
 *
 *   This rule is enforced by Mp4BuildInput validation.
 * }
 *
 * Rules:
 * - buildHints express preference or intent, NOT truth
 * - they MUST be optional and ignorable
 * - they MUST NOT affect semantic correctness
 *
 * Defaults:
 * - If neither `udtaBytes` nor `encoderIdentity` is provided,
 *   container metadata is governed entirely by policy
 *
 * -------------------------------------------------------------------------
 * What this function DOES
 * -------------------------------------------------------------------------
 *
 *   - validates the Mp4BuildInput grammar
 *   - normalizes semantic media facts
 *   - derives required structural information
 *   - applies explicit, named container policies
 *   - emits a fully assembled MP4 file
 *
 * -------------------------------------------------------------------------
 * What this function DOES NOT do
 * -------------------------------------------------------------------------
 *
 *   - does NOT perform I/O
 *   - does NOT download or save files
 *   - does NOT invent defaults
 *   - does NOT guess encoder intent
 *   - does NOT hide policy decisions
 *   - does NOT expose internal compiler phases
 *
 * All side effects are intentionally excluded.
 *
 * -------------------------------------------------------------------------
 * @param {Object} mp4BuildInput
 *   A valid Mp4BuildInput object conforming EXACTLY to the contract above.
 *
 * @returns {Uint8Array}
 *   The final MP4 file bytes.
 */
export function createMp4FromInputs(mp4BuildInput) {
   
    // ---------------------------------------------------------
    // Validation (grammar only):
    // probably should move this to createMp4FromInputs()
    // ---------------------------------------------------------
    validateMp4BuildInput(mp4BuildInput);

    return compileMp4FromMp4Input({
        resolvedMp4State: mp4BuildInput
    });
}


// INTERNAL: compiler implementation detail — use createMp4FromInputs() instead
/**
 * compileMp4FromMp4Input
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
 * compileMp4FromMp4Input assumes a validated Mp4BuildInput
 */
function compileMp4FromMp4Input({ resolvedMp4State }) {


    console.log(
        "DEBUG compiler semanticHints:",
        resolvedMp4State.semanticHints
    );

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
    normalizeAccessUnitsInPlace({
        accessUnits: resolvedMp4State.semanticCore.accessUnits
    });


    // =====================================================================
    // Tier 2 — Structural Derivation (strategy + derivation)
    // =====================================================================

    deriveStructuralStateInPlace(resolvedMp4State);

    // =====================================================================
    // Tier 4 — Container Policies (declared early for adapter consumption)
    // =====================================================================

    const compressorNamePolicy =
        applyCompressorNamePolicy({
            compressorName:
            resolvedMp4State.buildHints?.compressorName
        });

    // =====================================================================
    // Tier 3 — Adaptation (semantic → emitter parameters)
    // =====================================================================

    // -- Time-to-sample
    const sttsParams = adaptSttsFromSamples({
        samples: resolvedMp4State.semanticCore.accessUnits
    });

    // -- Sample sizes
    const stszParams = deriveStszSizesFromPayloads({
        accessUnits: resolvedMp4State.semanticCore.accessUnits,
        accessUnitPayloads: resolvedMp4State.payloads.accessUnitPayloads
    });

    // -- Composition offsets
    const cttsParams = adaptCttsFromSamples({
        samples: resolvedMp4State.semanticCore.accessUnits
    });

    const hasNonZeroCompositionOffset =
        cttsParams.entries.some(e => e.offset !== 0);

    // -- Chunk mapping
    const stscParams =
        adaptStscEntriesToEmitterParams(resolvedMp4State.stscEntries);

    // -- Codec / sample description (raw, pre-policy)
    const rawStsdParams = adaptCodecConfigurationToStsdParams(
        {
            codec:          resolvedMp4State.semanticCore.codec.codec,
            compressorName: compressorNamePolicy,
            avcC:           resolvedMp4State.semanticCore.codec.avcC,
            width:          resolvedMp4State.buildParameters.codedWidth,
            height:         resolvedMp4State.buildParameters.codedHeight
        }
    );

    // =====================================================================
    // Tier 4 — Container Policies (explicit, named decisions)
    // =====================================================================


    let avcCProfileIndication;

    if (resolvedMp4State.semanticCore.codec.avcCCompleteness === "semantic") {
        avcCProfileIndication = rawStsdParams.avcC[1];
    }

    // -- AVC container compatibility (High profile extension)
    const stsdParams = {
        codec: rawStsdParams.codec,
        width: rawStsdParams.width,
        height: rawStsdParams.height,
        compressorName: rawStsdParams.compressorName,

        // Optional policy: btrt
        // - sourced ONLY from buildHints
        // - validated and passed through verbatim
        // - omitted if not supplied
        btrt: applyBtrtContainerPolicy({
            btrt: resolvedMp4State.buildHints?.btrt
        }),

        // Mandatory policy: avcC compatibility
        avcC: applyAvcCContainerPolicy({
            avcC: rawStsdParams.avcC,
            avcCCompleteness: resolvedMp4State.semanticCore.codec.avcCCompleteness,
            profileIndication: avcCProfileIndication
        })

    };

    // =====================================================================
    // Tier 5 — Emission and Assembly
    // =====================================================================

    // ---------------------------------------------------------
    // MDAT (media payload)
    // ---------------------------------------------------------
    const {
        payload: mdatPayload,
        chunkOffsets
    } = assembleMdatPayloadFromChunks({
        accessUnitGroups: resolvedMp4State.chunks,
        accessUnitPayloads: resolvedMp4State.payloads.accessUnitPayloads
    });

    // ---------------------------------------------------------
    // Sample Table (stbl)
    // ---------------------------------------------------------
    const placeholderStco = emitStcoBox({
        chunkOffsets: new Array(resolvedMp4State.chunks.length).fill(0)
    });

    const stblChildren = {
        stsd: emitStsdBox(stsdParams),
        stts: emitSttsBox(sttsParams),
        stsc: emitStscBox(stscParams),
        stsz: emitStszBox(stszParams),
        stco: placeholderStco
    };

    if (resolvedMp4State.stssSampleNumbers.length > 0) {
        stblChildren.stss =
            emitStssBox({ sampleNumbers: resolvedMp4State.stssSampleNumbers });
    }

    if (hasNonZeroCompositionOffset) {
        stblChildren.ctts = emitCttsBox(cttsParams);
    }

    const stbl = emitStblBox(stblChildren);

    // ---------------------------------------------------------
    // Media boxes (mdia / minf)
    // ---------------------------------------------------------
    const dinf = emitDinfBox({
        dref: emitDrefBox()
    });

    const minf = emitMinfBox({
        vmhd: emitVmhdBox(),
        dinf,
        stbl
    });

    const mdhd = emitMdhdBox({
        timescale: resolvedMp4State.buildParameters.trackTimescale,
        duration: resolvedMp4State.trackDuration
    });

    const hdlr = emitHdlrBox(
        applyTrackHandlerPolicy({
            trackType: "video"
        })
    );

    const mdia = emitMdiaBox({
        mdhd,
        hdlr,
        minf
    });

    // ---------------------------------------------------------
    // Movie timing policy (container-level)
    // ---------------------------------------------------------
    const mvhdTiming = applyMovieTimingPolicy({
        trackDuration: resolvedMp4State.trackDuration,
        trackTimescale: resolvedMp4State.buildParameters.trackTimescale,
        trackId: 1,
        movieTimescale: resolvedMp4State.semanticHints?.movieTimescale
    });

    // ---------------------------------------------------------
    // Movie Header (mvhd)
    // ---------------------------------------------------------
    const mvhd = emitMvhdBox(mvhdTiming);

    // ---------------------------------------------------------
    // Track Header policy (container-level)
    // ---------------------------------------------------------
    const tkhdPolicy = applyTrackHeaderPolicy({
        mdhdTimescale: resolvedMp4State.buildParameters.trackTimescale,
        mdhdDuration:  resolvedMp4State.trackDuration,
        mvhdTimescale: mvhdTiming.timescale
    });

    const editListParams = applyEditListPolicy({
        trackDuration: resolvedMp4State.trackDuration,
        trackTimescale: resolvedMp4State.buildParameters.trackTimescale,
        movieTimescale: mvhdTiming.timescale,
        mediaStartTime: resolvedMp4State.semanticCore.accessUnits[0].pts
    });

    const edts = emitEdtsBox({
        elst: emitElstBox(editListParams.elst)
    });

    // ---------------------------------------------------------
    // Track and movie boxes
    // ---------------------------------------------------------

    // ---------------------------------------------------------
    // Track Header (tkhd)
    // ---------------------------------------------------------
    //
    // Track ID assignment
    // -------------------
    //
    // MP4 requires each track to have a positive integer track ID.
    // Under the current compiler constraints:
    //
    //   - exactly ONE track is supported
    //   - multi-track (e.g. audio) support is not yet implemented
    //   - no track ordering or numbering policy exists yet
    //
    // Therefore, the only valid and honest value is:
    //
    //   trackId = 1
    //
    // This is a CONTAINER-LEVEL decision, not a semantic media fact.
    //
    // When multi-track support is introduced, this value MUST be
    // replaced by an explicit Track ID Policy that assigns stable,
    // deterministic IDs across tracks.
    //

    // ---------------------------------------------------------
    // Track Header policy (container-level)
    // ---------------------------------------------------------
    const tkhd = emitTkhdBox({
        trackId: 1,
        duration: tkhdPolicy.duration,
        width: resolvedMp4State.buildParameters.codedWidth,
        height: resolvedMp4State.buildParameters.codedHeight,
        widthFraction: tkhdPolicy.widthFraction,
        heightFraction: tkhdPolicy.heightFraction
    });

    const trak = emitTrakBox({
        tkhd,
        edts,
        mdia
    });

    const udtaNode = applyUdtaPolicy({
        opaqueUdta: resolvedMp4State.buildHints?.udtaBytes,
        encoderIdentity: resolvedMp4State.buildHints?.encoderIdentity
    });

    // ---------------------------------------------------------
    // Movie Header (mvhd)
    // ---------------------------------------------------------
    //
    // nextTrackId assignment
    // ----------------------
    //
    // MP4 requires mvhd.next_track_ID to indicate the next
    // available track identifier.
    //
    // Under current constraints:
    //   - exactly ONE track is supported
    //   - that track is assigned trackId = 1
    //
    // Therefore, the only valid value is:
    //
    //   nextTrackId = 2
    //
    // This is a CONTAINER-LEVEL decision.
    // When multi-track support is added, this MUST be replaced
    // by an explicit Track ID allocation policy.
    //
    const moov = emitMoovBox({
        mvhd,
        traks: [trak],
        udta: udtaNode 
    });

    // DEBUG: inspect moov box structure before serialization
    console.log("=== DEBUG: moov box structure ===");
    console.log("moov.type:", moov.type);
    console.log(
        "moov.children:",
        moov.children.map(child => child.type)
    );

    const moovUdta = moov.children.find(child => child.type === "udta");

    if (!moovUdta) {
        console.log("DEBUG: moov has NO udta child");
    } else {
        console.log("DEBUG: moov.udta found");
        console.log("  udta.__opaque:", moovUdta.__opaque === true);
        console.log(
            "  udta.children:",
            Array.isArray(moovUdta.children)
            ? moovUdta.children.map(c => c.type)
            : moovUdta.children
        );
    }
    console.log("=== END DEBUG ===");

    // END DEBUG

    const ftyp = emitFtypBox({
        majorBrand: "isom",
        minorVersion: 512,
        compatibleBrands: ["isom", "iso2", "avc1", "mp41"]
    });

    // ---------------------------------------------------------
    // Physical layout + final file assembly
    // ---------------------------------------------------------
    const layout = resolvePhysicalLayout({
        ftypNode: ftyp,
        moovNode: moov,
        mdatPayload,
        chunkOffsets
    });

    const committedMoov = commitMoovWithResolvedLayout({
        originalMoovNode: moov,
        stcoOffsets: layout.stcoOffsets
    });

    return emitMp4FileFromResolvedParts({
        ftypNode: ftyp,
        committedMoovNode: committedMoov,
        mdatPayload,
        fileBoxOrder: layout.fileBoxOrder
    });
}

function deriveStructuralStateInPlace(resolvedMp4State) {

    const accessUnits =
        resolvedMp4State.semanticCore.accessUnits;

    // ---------------------------------------------------------
    // Decode timestamp derivation (compiler-owned)
    // ---------------------------------------------------------

    deriveDecodeTimestampsInPlace({
        accessUnits,
        strategy:
        DecodeOrderStrategies.DECODE_ORDER_EQUALS_SAMPLE_ORDER
    });

    // ---------------------------------------------------------
    // Chunk topology (strategy-selected)
    // ---------------------------------------------------------

    resolvedMp4State.chunks = deriveChunkModel(
        accessUnits,
        "all-samples-one-chunk"
    );

    // ---------------------------------------------------------
    // Sample table derivations
    // ---------------------------------------------------------

    resolvedMp4State.stscEntries = deriveStscEntries({
        samples: accessUnits,
        chunks: resolvedMp4State.chunks
    });

    resolvedMp4State.stssSampleNumbers = deriveStssSampleNumbers({
        samples: accessUnits
    });

    resolvedMp4State.trackDuration = deriveTrackDuration({
        samples: accessUnits
    });
}


/* ============================================================================
 * TEST A — Semantic canonical assembly
 * ============================================================================
 *
 * Contract:
 * ---------
 * This test asserts that the frozen semantic fixtures are SUFFICIENT
 * to reproduce all MP4 bytes that are *semantically determined* by:
 *
 *   - access unit timing
 *   - access unit sizes
 *   - chunking policy
 *   - codec configuration
 *   - track- and movie-level timing metadata
 *
 * In other words:
 *   If a byte can be derived from the semantic inputs, it MUST match
 *   the oracle MP4 exactly.
 *
 * This test does NOT assert full byte-for-byte equivalence with the oracle.
 * That would be dishonest, because the semantic fixtures intentionally omit
 * representational metadata that is:
 *
 *   - not derivable from samples
 *   - not required for playback
 *   - encoder- or history-dependent
 *
 * Known, intentional divergences:
 * -------------------------------
 * The following boxes (or fields within them) are allowed to differ:
 *
 *   - moov/trak/tkhd
 *       Fractional width/height fields are representational and are not
 *       included in the semantic fixtures.
 *
 *   - moov/trak/edts
 *       Edit list semantics are not modeled at the semantic level.
 *       The box may exist structurally, but its contents are not asserted.
 *
 *   - moov/udta
 *       User data is opaque, non-semantic, and intentionally excluded.
 *
 * Any mismatch outside of these explicitly-declared paths is a HARD FAILURE
 * and indicates either:
 *
 *   - an incomplete semantic fixture, or
 *   - an incorrect derivation or assembly step in the compiler.
 *
 * Full byte-for-byte equivalence with the oracle is asserted separately
 * in TEST B, where the missing representational inputs are supplied.
 */
export async function test_NativeMuxer_EndToEnd_FromMp4BuildInput_Canonical() {
    console.log("=== test_NativeMuxer_EndToEnd_FromMp4BuildInput_Canonical ===");

    const resp = await fetch("reference/reference_visual.mp4");
    const goldenMp4 = new Uint8Array(await resp.arrayBuffer());

    const mp4BuildInput =
        await runGoldenMp4TestClient({
            mp4Bytes: goldenMp4
        });

    const outBytes = createMp4FromInputs(mp4BuildInput);

    assertBoxTreeStructure({
        testName: "Semantic canonical",
        outBytes,
        goldenBytes: goldenMp4
    });

    console.log("PASS: semantic fixtures produce valid MP4");
}


/* ============================================================================
 * NOTE — Planned TEST A2: Semantic sufficiency without keyframe semantics
 * ============================================================================
 *
 * There exists a SECOND valid semantic sufficiency case that is not yet
 * exercised by this file.
 *
 * In MP4, the Sync Sample Box (`stss`) is OPTIONAL.
 * It must be emitted if and only if keyframe information is semantically
 * available.
 *
 * Specifically:
 *
 *   - If samples include an `isKey` (sync) attribute:
 *       → `stss` is derivable and MUST be emitted.
 *
 *   - If samples do NOT include `isKey`:
 *       → `stss` is NOT derivable and MUST NOT be emitted.
 *
 * Both cases produce valid, playable MP4 files.
 *
 * The current semantic fixtures include `isKey`, therefore TEST A asserts
 * the presence and correctness of `stss`.
 *
 * A future TEST A2 must assert the dual case:
 *
 *   Given identical semantic inputs EXCEPT with `isKey` removed from samples,
 *   the compiler must:
 *
 *     - omit the `stss` box entirely
 *     - preserve correctness of all other semantically-derivable boxes
 *     - still produce a valid, playable MP4
 *
 * This test is intentionally deferred.
 * Its absence is NOT a bug, but a known, recorded semantic contract.
 *
 * This comment exists to prevent accidental loss of that contract.
 */

/**
 * NOTE — Planned TEST A3: Semantic avcC sufficiency
 * -----------------------------------------------
 *
 * This file currently exercises the canonical end-to-end compilation path
 * using a Golden MP4 source adapter.
 *
 * In this configuration, the avcC provided to the compiler is
 * container-complete, reflecting historical container decisions made
 * by ffmpeg.
 *
 * There exists a SECOND valid semantic sufficiency case that is not yet
 * exercised by this test:
 *
 *   - The input avcC is SEMANTIC ONLY (as emitted by WebCodecs)
 *   - The compiler applies container completion policy
 *   - The resulting MP4 is byte-for-byte identical to the golden oracle
 *
 * This test will:
 *
 *   - Derive a semantic avcC from the golden oracle
 *   - Mark it as semantic-only in Mp4BuildInput
 *   - Compile through the full pipeline
 *   - Assert byte-for-byte equivalence with the canonical MP4
 *
 * This test is intentionally deferred until:
 *
 *   - avcC container policy is locked by isolated equivalence tests
 *   - semantic sufficiency variants are treated uniformly
 *
 * This note exists to:
 *
 *   - make the architectural intent explicit
 *   - prevent accidental regression
 *   - document that semantic avcC is a FIRST-CLASS supported input
 */

/* ============================================================================
 * NOTE — Planned TEST A4: Semantic-only WebCodecs input (no oracle)
 * ============================================================================
 *
 * There exists a FIRST-CLASS NativeMuxer use case that cannot be validated
 * via oracle byte-for-byte comparison:
 *
 *   - input is produced by WebCodecs (or another encoder API)
 *   - no prior MP4 container exists
 *   - therefore, no historical representation can be preserved
 *
 * In this scenario:
 *
 *   - semantic media facts are available
 *   - container policy is applied explicitly
 *   - representational details are chosen deterministically by the compiler
 *
 * This test asserts SEMANTIC STRUCTURAL CORRECTNESS, not representational
 * equivalence.
 *
 * ---------------------------------------------------------------------------
 * Contract
 * ---------------------------------------------------------------------------
 *
 * Given:
 *   - Mp4BuildInput constructed from semantic encoder output
 *   - avcC marked as "semantic" (not container-complete)
 *   - no buildHints.udtaBytes
 *   - optional buildHints.encoderIdentity
 *
 * The compiler MUST:
 *
 *   - produce a valid, playable MP4
 *   - emit all boxes that are semantically or policy-required
 *   - omit boxes that are not semantically derivable and not requested
 *     (e.g. udta when no authorship is declared)
 *   - apply container completion policy deterministically
 *
 * The test MUST NOT:
 *
 *   - assert byte-for-byte equivalence with any external file
 *   - assume specific encoder defaults beyond declared policy
 *   - rely on historical container structure
 *
 * Validation strategy:
 *   - structural box tree validation
 *   - field-level assertions for semantically derivable values
 *   - explicit omission assertions (e.g. absence of stss, udta, etc. when
 *     not semantically justified)
 *
 * This test establishes that NativeMuxer is correct as a PRODUCER,
 * not merely as a REPRODUCER.
 *
 * Its absence is intentional at this stage and is recorded here
 * to prevent accidental semantic regression.
 */

function readUint32BE(bytes, offset) {
    return (
        (bytes[offset]     << 24) |
        (bytes[offset + 1] << 16) |
        (bytes[offset + 2] << 8)  |
        (bytes[offset + 3])
    ) >>> 0;
}

function readUint16BE(bytes, offset) {
    return (
        (bytes[offset]     << 8) |
        (bytes[offset + 1])
    ) >>> 0;
}

function readAscii(bytes, offset, length) {
    return String.fromCharCode(
        ...bytes.slice(offset, offset + length)
    );
}

function readStsdFieldsFromRaw(raw) {
    const entryOffset = 16;
    const entrySize   = readUint32BE(raw, entryOffset);

    const compressorNameBytes =
        raw.slice(66, 66 + 32);

    const compressorNameLength =
        compressorNameBytes[0];

    const compressorName =
        readAscii(
            compressorNameBytes,
            1,
            compressorNameLength
        );

    return {
        stsd: {
            size: readUint32BE(raw, 0),
            version: raw[8],
            flags:
                (raw[9] << 16) |
                (raw[10] << 8) |
                raw[11],
            entryCount: readUint32BE(raw, 12),
        },

        sampleEntry: {
            size: entrySize,
            type: readAscii(raw, 20, 4),
            dataReferenceIndex: readUint16BE(raw, 30),
            width: readUint16BE(raw, 48),
            height: readUint16BE(raw, 50),
            horizResolution: readUint32BE(raw, 52),
            vertResolution:  readUint32BE(raw, 56),
            frameCount: readUint16BE(raw, 64),
            depth: readUint16BE(raw, 98),
            compressorName,
            compressorNameLength,
        },

        trailingBytes: raw.length - (entryOffset + entrySize)
    };
}

function logStsdDiff({ oracleRaw, producedRaw }) {
    const oracle   = readStsdFieldsFromRaw(oracleRaw);
    const produced = readStsdFieldsFromRaw(producedRaw);

    console.log("=== STSD FIELD DIFF (ORACLE vs PRODUCED) ===");

    for (const section of ["stsd", "sampleEntry"]) {
        for (const key of Object.keys(oracle[section])) {
            console.log(
                `${section}.${key}:`,
                "ORACLE =", oracle[section][key],
                "| PRODUCED =", produced[section][key]
            );
        }
    }

    console.log(
        "trailingBytes:",
        "ORACLE =", oracle.trailingBytes,
        "| PRODUCED =", produced.trailingBytes
    );

    console.log("=== END STSD DIFF ===");
}

let __recursionDepth = 0;

function compareBoxRecursive({
    path,
    outBoxBytes,
    refBoxBytes,
}) {

    // ---------------------------------------------------------
    // Recursion guard
    // ---------------------------------------------------------
    __recursionDepth++;

    if (__recursionDepth > 200) {
        throw new Error(
            [
                "RECURSION DEPTH EXCEEDED",
                `depth=${__recursionDepth}`,
                `path=${path}`,
                `outBoxBytes.length=${outBoxBytes?.length}`,
                `refBoxBytes.length=${refBoxBytes?.length}`
            ].join("\n")
        );
    }

    assertExists(`box ${path}`, outBoxBytes);
    assertExists(`reference box ${path}`, refBoxBytes);

    // ---------------------------------------------------------
    // LEAF BOX — byte comparison
    // ---------------------------------------------------------
    if (outBoxBytes.length === 8 || !isContainerBox(outBoxBytes)) {
        assertEqual(
            `${path}.size`,
            outBoxBytes.length,
            refBoxBytes.length
        );

        for (let i = 0; i < refBoxBytes.length; i++) {
            assertEqualHex(
                `${path}.byte[${i}]`,
                outBoxBytes[i],
                refBoxBytes[i]
            );
        }

        __recursionDepth--;
        return;
    }

    // ---------------------------------------------------------
    // CONTAINER BOX — recurse
    // ---------------------------------------------------------
    const outContainer = asContainer(outBoxBytes);
    const refContainer = asContainer(refBoxBytes);

    const outChildren = outContainer.enumerateChildren();
    const refChildren = refContainer.enumerateChildren();

    const refTypes = refChildren.map(c => c.type);
    const outTypes = outChildren.map(c => c.type);

    const missing = refTypes.filter(t => !outTypes.includes(t));
    const extra   = outTypes.filter(t => !refTypes.includes(t));

    if (missing.length || extra.length) {
        throw new Error(
            [
                "MP4 STRUCTURE MISMATCH",
                `Location: ${path}`,
                missing.length
                ? `Missing box(es): ${missing.join(", ")}`
                : null,
                extra.length
                ? `Unexpected box(es): ${extra.join(", ")}`
                : null,
                `Expected order: ${refTypes.join(" → ")}`,
                `Actual order:   ${outTypes.join(" → ")}`
            ]
            .filter(Boolean)
            .join("\n")
        );
    }

    for (let i = 0; i < refChildren.length; i++) {
        const refMeta = refChildren[i];
        const outMeta = outChildren[i];

        assertEqual(
            `${path}[${i}].type`,
            outMeta.type,
            refMeta.type
        );

        const childPath = `${path}/${refMeta.type}`;

        const refChildBytes =
            extractChildBoxFromContainer(refBoxBytes, refMeta.type);

        const outChildBytes =
            extractChildBoxFromContainer(outBoxBytes, outMeta.type);

        compareBoxRecursive({
            path: childPath,
            outBoxBytes: outChildBytes,
            refBoxBytes: refChildBytes,
        });

        assertEqual(
            `${childPath}.size`,
            outChildBytes.length,
            refChildBytes.length
        );
    }

    __recursionDepth--;
}

function assertBoxTreeStructure({
    testName,
    outBytes,
    goldenBytes,
    ignoreBoxes = new Set()
}) {
    const outRoot  = asContainer(outBytes);
    const goldRoot = asContainer(goldenBytes);

    const outChildren  = outRoot.enumerateChildren();
    const goldChildren = goldRoot.enumerateChildren();

    assertEqual(
        `${testName}: top-level box count`,
        outChildren.length,
        goldChildren.length
    );

    for (let i = 0; i < goldChildren.length; i++) {
        const ref = goldChildren[i];
        const out = outChildren[i];

        assertEqual(
            `${testName}: top-level[${i}].type`,
            out.type,
            ref.type
        );

        compareBoxRecursive({
            path: ref.type,
            outBoxBytes: extractBoxByPathFromMp4(outBytes, ref.type),
            refBoxBytes: extractBoxByPathFromMp4(goldenBytes, ref.type),
            ignoreBoxes
        });

    }
}

function isContainerBox(boxBytes) {
    const type =
        String.fromCharCode(
            boxBytes[4],
            boxBytes[5],
            boxBytes[6],
            boxBytes[7]
        );

    return (
        type === "moov" ||
        type === "trak" ||
        type === "mdia" ||
        type === "minf" ||
        type === "stbl" ||
        type === "dinf"
    );
}


