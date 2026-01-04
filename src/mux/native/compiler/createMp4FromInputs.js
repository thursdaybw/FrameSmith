import { validateMp4BuildInput }
    from "../validateMp4BuildInput.js";

import { compileMp4 }
    from "./compileMp4.js";

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

    return compileMp4({
        mp4CompilerState: mp4BuildInput
    });
}
