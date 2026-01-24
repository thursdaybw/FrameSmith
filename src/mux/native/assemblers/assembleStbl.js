// STBL — Sample Table Assembly
// ============================
//
// This module performs *pure structural assembly* of an STBL box.
//
// -----------------------------------------------------------------------------
// Purpose
// -----------------------------------------------------------------------------
//
// `assembleStbl` exists to wire together *already-emitted* STBL child boxes
// into a single STBL container, using the canonical ordering and optionality
// rules defined by the MP4 format.
//
// It is intentionally shared by:
//   - golden box tests (locked-layout equivalence)
//   - the MP4 compiler assembly phase
//
// This avoids duplicated wiring logic between tests and production code.
//
// -----------------------------------------------------------------------------
// What this module DOES
// -----------------------------------------------------------------------------
//
// - Accepts pre-emitted box nodes (stsd, stts, stsc, stsz, stco, etc.)
// - Enforces required vs optional children at the wiring boundary
// - Delegates final container construction to `emitStblBox`
//
// -----------------------------------------------------------------------------
// What this module DOES NOT do
// -----------------------------------------------------------------------------
//
// - Does NOT derive sample tables
// - Does NOT compute chunk offsets
// - Does NOT inspect child internals
// - Does NOT apply container policy
// - Does NOT depend on compiler state
//
// All derivation, normalization, and policy decisions MUST happen upstream.
//
// -----------------------------------------------------------------------------
// Architectural Role
// -----------------------------------------------------------------------------
//
// This is NOT a compiler phase.
// This is NOT a box emitter.
// This is a minimal, deterministic *assembly helper*.
//
// Think of it as a named wiring diagram.
//
// -----------------------------------------------------------------------------
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";

/**
 * ASSEMBLER CONTRACT
 * ==================
 *
 * This function accepts SEMANTIC INTENT ONLY.
 *
 * It MUST NOT receive:
 * - serialized box bytes
 * - box headers
 * - emitter nodes
 *
 * It MUST:
 * - validate intent types and ranges
 * - construct child boxes via EmitterRegistry
 *
 * If you are unsure whether a value belongs here:
 * - raw bytes → extractor or serializer
 * - structural nodes → emitter
 * - semantic values → assembler
 */
function assembleStbl(intent, { emitContainer }) {
    if (typeof intent !== "object" || intent === null) {
        throw new Error("assembleStbl: expected intent object");
    }

    const children = {};

    // ---------------------------------------------------------
    // Required children
    // ---------------------------------------------------------

    children.stsd =
        EmitterRegistry.assemble(
            "moov/trak/mdia/minf/stbl/stsd",
            intent.stsd
        );

    children.stts =
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/stts",
            intent.stts
        );

    children.stsc =
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/stsc",
            intent.stsc
        );

    children.stsz =
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/stsz",
            intent.stsz
        );

    children.stco =
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/stco",
            intent.stco
        );

    // ---------------------------------------------------------
    // Optional children
    // ---------------------------------------------------------

    if (intent.stss) {
        children.stss =
            EmitterRegistry.emit(
                "moov/trak/mdia/minf/stbl/stss",
                intent.stss
            );
    }

    if (intent.ctts) {
        children.ctts =
            EmitterRegistry.emit(
                "moov/trak/mdia/minf/stbl/ctts",
                intent.ctts
            );
    }

    if (intent.sgpd) {
        const variant =
            intent.sgpd.defaultLength === 0
            ? "variable"
            : "fixed";

        children.sgpd =
            EmitterRegistry.emit(
                `moov/trak/mdia/minf/stbl/sgpd|${variant}`,
                intent.sgpd
            );
    }

    if (intent.sbgp) {
        children.sbgp =
            EmitterRegistry.emit(
                "moov/trak/mdia/minf/stbl/sbgp",
                intent.sbgp
            );
    }

    const node =
        emitContainer(
            "moov/trak/mdia/minf/stbl",
            children
        );

    return node;

}

export function registerStblAssembler(registry) {
    registry.registerAssembler(
        "moov/trak/mdia/minf/stbl",
        assembleStbl
    );
}
