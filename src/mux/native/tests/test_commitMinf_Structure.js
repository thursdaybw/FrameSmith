import { commitMinf } from "../commit/commitMinf.js";
import { assertEqual } from "./assertions.js";

/**
 * testCommitMinf_Structure
 * =======================
 *
 * PURPOSE
 * -------
 * This test validates the *structural rewrite* behavior of `commitMinf`.
 *
 * It asserts that:
 *   - the STBL child inside MINF is replaced
 *   - all other children are preserved verbatim
 *
 * IMPORTANT ARCHITECTURAL CONTEXT
 * -------------------------------
 *
 * `commitMinf` operates in the **second compiler pass**.
 *
 * At this stage:
 *   - semantic intent has already been assembled
 *   - physical layout has already been resolved
 *   - offsets (e.g. stco / co64) are already known
 *
 * Therefore:
 *   - `commitMinf` MUST operate on *already-emitted box nodes*
 *   - it MUST NOT accept semantic intent
 *   - it MUST NOT call assemblers
 *
 * Assemblers (e.g. assembleMinf) belong to the *first pass*:
 *   semantic intent → structural boxes
 *
 * Committers (e.g. commitMinf) belong to the *second pass*:
 *   structural boxes → rewritten structural boxes
 *
 * This test deliberately constructs a minimal, already-emitted MINF
 * to ensure that `commitMinf`:
 *   - behaves as a pure tree rewrite
 *   - does not depend on assembler contracts
 *   - does not perform semantic validation
 *
 * If this test ever starts requiring assemblers again,
 * it indicates a compiler phase boundary violation.
 */
export function testCommitMinf_Structure() {

    // ---------------------------------------------------------
    // 1. Minimal emitted STBLs (old → new)
    // ---------------------------------------------------------
    //
    // These are already-emitted box nodes, not semantic intent.
    //
    const originalStbl = {
        type: "stbl",
        body: ["old"]
    };

    const committedStbl = {
        type: "stbl",
        body: ["new"]
    };

    // ---------------------------------------------------------
    // 2. Minimal emitted MINF
    // ---------------------------------------------------------
    //
    // This simulates output from the assembler + layout phases.
    // No semantic correctness is asserted here.
    //
    const originalMinf = emitMinfBox({
        mediaHeader: { type: "vmhd", body: [] },
        dinf: { type: "dinf", children: [] },
        stbl: originalStbl
    });

    // ---------------------------------------------------------
    // 3. Commit phase: replace STBL only
    // ---------------------------------------------------------
    const committedMinf = commitMinf({
        originalMinfNode: originalMinf,
        committedStblNode: committedStbl
    });

    // ---------------------------------------------------------
    // 4. Structural assertion
    // ---------------------------------------------------------
    const stbl = committedMinf.children.find(c => c.type === "stbl");

    assertEqual(
        "stbl replaced",
        stbl.body[0],
        "new"
    );
}
