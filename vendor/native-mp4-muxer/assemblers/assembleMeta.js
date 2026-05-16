import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";

/**
 * META — Metadata Container Assembly
 * ==================================
 *
 * Pure container assembly for the `meta` box.
 *
 * Accepts semantic intent only.
 * Builds child boxes via the registry.
 * Delegates final construction to emitMetaBox via emitContainer.
 */
function assembleMeta(intent, { emitContainer }) {

    if (typeof intent !== "object" || intent === null) {
        throw new Error("assembleMeta: expected intent object");
    }

    const { hdlr, ilst } = intent;

    if (typeof hdlr !== "object" || hdlr === null) {
        throw new Error("assembleMeta: 'hdlr' intent object is required");
    }

    if (typeof ilst !== "object" || ilst === null) {
        throw new Error("assembleMeta: 'ilst' intent object is required");
    }

    const hdlrNode =
        EmitterRegistry.emit(
            "moov/udta/meta/hdlr",
            hdlr
        );

    const ilstNode =
        EmitterRegistry.assemble(
            "moov/udta/meta/ilst",
            ilst
        );

    return emitContainer(
        "moov/udta/meta",
        {
            hdlr: hdlrNode,
            ilst: ilstNode
        }
    );
}

export function registerMetaAssembler(registry) {
    registry.registerAssembler(
        "moov/udta/meta",
        assembleMeta
    );
}
