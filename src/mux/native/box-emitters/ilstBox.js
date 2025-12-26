/**
 * ILST — Item List Box
 * ===================
 *
 * The `ilst` box is a container for metadata item atoms.
 *
 * Structure:
 * ----------
 *   size (4)
 *   type (4)  "ilst"
 *   children:
 *     - one or more ilst item atoms (e.g. ©nam, @too, etc)
 *
 * Responsibilities:
 * -----------------
 * - preserve ordering of item atoms
 * - act purely as a container
 *
 * Non-responsibilities:
 * ---------------------
 * - interpret item meaning
 * - validate item payloads
 * - enforce metadata policy
 *
 * The ilst box has:
 * - no body fields
 * - no version
 * - no flags
 */
export function emitIlstBox(params) {

    // ---------------------------------------------------------
    // Contract validation
    // ---------------------------------------------------------
    if (typeof params !== "object" || params === null) {
        throw new Error(
            "emitIlstBox: expected a parameter object"
        );
    }

    const { items } = params;

    if (!Array.isArray(items)) {
        throw new Error(
            "emitIlstBox: 'items' must be an array"
        );
    }

    for (let i = 0; i < items.length; i++) {
        const item = items[i];

        if (typeof item !== "object" || item === null) {
            throw new Error(
                `emitIlstBox: item[${i}] must be a box node`
            );
        }

        if (typeof item.type !== "string" || item.type.length !== 4) {
            throw new Error(
                `emitIlstBox: item[${i}] must have a FourCC 'type'`
            );
        }
    }

    // ---------------------------------------------------------
    // ILST box construction
    // ---------------------------------------------------------
    return {
        type: "ilst",
        children: items
    };
}
