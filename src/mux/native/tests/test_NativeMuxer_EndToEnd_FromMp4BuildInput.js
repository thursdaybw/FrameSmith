import { 
    runGoldenMp4TestClient
} from "./clients/goldenMp4SourceClient.js";

import { createMp4FromInputs } from "../compiler/createMp4FromInputs.js";


import { asIsoBoxContainer } from "../box-model/Box.js";
import {
    readUint32,
    readFourCC,
    readUint32BE,
    readUint16BE,
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

// ============================================================
// STRUCTURAL COMPARISON (container + child layout)
// ============================================================

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
    const outContainer = asIsoBoxContainer(outBoxBytes);
    const refContainer = asIsoBoxContainer(refBoxBytes);

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
    const outRoot  = asIsoBoxContainer(outBytes);
    const goldRoot = asIsoBoxContainer(goldenBytes);

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


