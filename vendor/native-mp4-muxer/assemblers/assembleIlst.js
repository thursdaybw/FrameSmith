import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";

/**
 * ILST — Item List Assembly
 * ========================
 *
 * Pure container assembly for the `ilst` box.
 *
 * Accepts semantic intent only.
 * Builds ilst item boxes via the registry.
 * Delegates final construction to emitIlstBox via emitContainer.
 */
function assembleIlst(intent, { emitContainer }) {

    if (typeof intent !== "object" || intent === null) {
        throw new Error("assembleIlst: expected intent object");
    }

    const { items } = intent;

    if (!Array.isArray(items)) {
        throw new Error("assembleIlst: 'items' must be an array");
    }

    const itemNodes = items.map((itemIntent, index) => {

        if (typeof itemIntent !== "object" || itemIntent === null) {
            throw new Error(
                `assembleIlst: items[${index}] must be an object`
            );
        }

        return EmitterRegistry.assemble(
            "moov/udta/meta/ilst/{atom}",
            itemIntent
        );
    });

    return emitContainer(
        "moov/udta/meta/ilst",
        { items: itemNodes }
    );
}

export function registerIlstAssembler(registry) {
    registry.registerAssembler(
        "moov/udta/meta/ilst",
        assembleIlst
    );
}
