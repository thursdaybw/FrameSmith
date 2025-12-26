/**
 * META — Metadata Container Box
 *
 * Role
 * ----
 * A FullBox container that groups metadata under a dedicated
 * handler namespace.
 *
 * Ground truth (ffmpeg inspection):
 *
 *   meta (FullBox)
 *     ├─ hdlr (metadata handler, type "mdir")
 *     └─ ilst (item list)
 *
 * Responsibilities:
 * - Emit a FullBox header (version + flags)
 * - Enforce child presence and ordering
 * - Assemble children verbatim
 *
 * Non-responsibilities:
 * - Interpreting metadata semantics
 * - Choosing metadata schema
 * - Computing layout or offsets
 * - Validating child contents
 *
 * This box is a pure structural boundary.
 */
export function emitMetaBox(params) {

    // ---------------------------------------------------------
    // Parameter validation
    // ---------------------------------------------------------
    if (typeof params !== "object" || params === null) {
        throw new Error(
            "emitMetaBox: expected parameter object"
        );
    }

    const { hdlr, ilst } = params;

    if (!hdlr || typeof hdlr !== "object" || hdlr.type !== "hdlr") {
        throw new Error(
            "emitMetaBox: 'hdlr' child box is required"
        );
    }

    if (!ilst || typeof ilst !== "object" || ilst.type !== "ilst") {
        throw new Error(
            "emitMetaBox: 'ilst' child box is required"
        );
    }

    // ---------------------------------------------------------
    // FullBox container
    // ---------------------------------------------------------
    return {
        type: "meta",
        version: 0,
        flags: 0,

        children: [
            hdlr,
            ilst
        ]
    };
}
