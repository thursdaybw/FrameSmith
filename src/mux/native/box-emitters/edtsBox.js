/**
 * EDTS — Edit Box
 * ---------------
 * Container for edit-related timing information.
 *
 * The Edit Box exists to group edit list structures that
 * modify how media time is mapped to presentation time.
 *
 * This box:
 *   - has no version
 *   - has no flags
 *   - has no fields of its own
 *
 * It is a *pure container*.
 *
 * ---
 *
 * What EDTS does:
 * ----------------
 * - Defines a boundary in the MP4 hierarchy
 * - Groups one or more edit-related child boxes
 *
 * ---
 *
 * What EDTS does NOT do:
 * ----------------------
 * - It does NOT define timing itself
 * - It does NOT compute edits
 * - It does NOT interpret edit semantics
 *
 * Those responsibilities belong to its children
 * (notably `elst`) and to higher-level assembly logic.
 *
 * ---
 *
 * Architectural role:
 * -------------------
 * EDTS is a structural boundary only.
 *
 * This builder:
 *   - validates the parameter object
 *   - validates child box shape
 *   - preserves child ordering as provided
 *   - does NOT assume which children are required
 *
 * Requirements are discovered by tests against
 * real-world MP4s (e.g. ffmpeg output).
 */
export function emitEdtsBox(children) {

    // ---------------------------------------------------------
    // Contract validation
    // ---------------------------------------------------------
    if (typeof children !== "object" || children === null) {
        throw new Error(
            "emitEdtsBox: expected a parameter object"
        );
    }

    const childNodes = [];

    for (const [name, node] of Object.entries(children)) {
        if (typeof node !== "object" || node === null) {
            throw new Error(
                `emitEdtsBox: child '${name}' must be a box node`
            );
        }

        if (node.type !== name) {
            throw new Error(
                `emitEdtsBox: child '${name}' has incorrect type '${node.type}'`
            );
        }

        childNodes.push(node);
    }

    // ---------------------------------------------------------
    // Container assembly
    // ---------------------------------------------------------
    return {
        /**
         * Box type
         */
        type: "edts",

        /**
         * Child boxes
         *
         * Ordering is preserved exactly as provided.
         * Required children are enforced by tests,
         * not by assumptions here.
         */
        children: childNodes
    };
}
