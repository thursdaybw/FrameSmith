/**
 * ILST Item Box
 * =============
 *
 * Represents a single metadata item inside an `ilst` box.
 *
 * This box:
 *   - has a dynamic FourCC type (eg "©too", "©nam")
 *   - contains one or more child boxes (observed: exactly one `data`)
 *
 * IMPORTANT:
 * - This is treated as a normal MP4 box.
 * - No semantics are interpreted here.
 * - The builder enforces structure only.
 *
 * Structure:
 *   size (4)
 *   type (4)   ← dynamic FourCC
 *   children…
 */
export function emitIlstItemBox(params) {

    // ---------------------------------------------------------
    // Contract validation
    // ---------------------------------------------------------
    if (typeof params !== "object" || params === null) {
        throw new Error(
            "emitIlstItemBox: expected a parameter object"
        );
    }

    const {
        type,
        data
    } = params;

    // ---------------------------------------------------------
    // Type validation
    // ---------------------------------------------------------
    if (typeof type !== "string" || type.length !== 4) {
        throw new Error(
            "emitIlstItemBox: 'type' must be a FourCC string (length 4)"
        );
    }

    // ---------------------------------------------------------
    // Child validation
    // ---------------------------------------------------------
    if (typeof data !== "object" || data === null) {
        throw new Error(
            "emitIlstItemBox: 'data' must be a box node"
        );
    }

    if (data.type !== "data") {
        throw new Error(
            `emitIlstItemBox: expected child box of type 'data', got '${data.type}'`
        );
    }

    // ---------------------------------------------------------
    // Box assembly
    // ---------------------------------------------------------
    //
    // No body.
    // One child box.
    // Ordering is fixed by construction.
    //
    return {
        type,
        children: [ data ]
    };
}
