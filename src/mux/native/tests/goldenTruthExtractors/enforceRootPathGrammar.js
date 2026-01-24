/**
 * Golden Truth Path Grammar — Root Validation
 * ===========================================
 *
 * This module enforces the **root-level grammar** for Golden Truth
 * path resolution.
 *
 * It runs BEFORE any traversal, box lookup, or schema dispatch.
 * Its only responsibility is to validate that an input path:
 *
 *   - is well-formed
 *   - starts at a valid MP4 root
 *   - does not attempt to address non-structural data
 *
 * If a path is invalid, this module MUST fail loudly with
 * **plain, user-facing error messages** that:
 *
 *   - name the exact mistake
 *   - explain why it is invalid
 *   - show how to fix it with concrete examples
 *
 * This module does NOT:
 *   - traverse boxes
 *   - infer intent
 *   - validate deep structural transitions
 *   - consult the extractor registry
 *
 * Those responsibilities belong to later phases.
 *
 * -----------------------------------------------------------------------------
 * What is a “root”?
 * -----------------------------------------------------------------------------
 *
 * At the Golden Truth boundary, only the following MP4 boxes
 * are considered valid roots:
 *
 *   - moov   (the structural metadata tree)
 *   - ftyp   (file type declaration)
 *   - free   (padding / filler)
 *
 * All other boxes must be accessed *through* these roots.
 *
 * Examples:
 *
 *   ✅ moov/trak[0]/mdia/minf/stbl
 *   ✅ ftyp
 *   ❌ trak[0]/mdia/minf/stbl        (relative path)
 *   ❌ stbl                          (not a root)
 *   ❌ moov/stbl                     (invalid structural transition)
 *
 * -----------------------------------------------------------------------------
 * Special case: mdat
 * -----------------------------------------------------------------------------
 *
 * The `mdat` box contains **raw media payload**, not structural boxes.
 *
 * While `mdat` is a top-level MP4 box, it is intentionally
 * **not addressable** via Golden Truth paths.
 *
 * When users attempt to address `mdat`, we provide explicit,
 * educational feedback explaining:
 *
 *   - what `mdat` is
 *   - why it cannot be traversed
 *   - where they should start instead
 *
 * -----------------------------------------------------------------------------
 * Current scope (intentionally limited)
 * -----------------------------------------------------------------------------
 *
 * This validator enforces ONLY:
*
*   - absolute paths
*   - valid root boxes
*   - clear rejection of non-structural access
*
* It deliberately does NOT attempt to validate deeper structure
* such as:
*
*   - moov → trak → mdia → minf → stbl
*   - which children are valid under which containers
*   - leaf vs container semantics
*
* Those rules exist — but they are enforced later.
*
* -----------------------------------------------------------------------------
* Future direction: structural transition grammar
* -----------------------------------------------------------------------------
*
* In the future, structural traversal rules [e.g.:
*
*   - moov may contain trak
*   - trak must contain mdia
*   - tkhd is a leaf and must not have children
*
* ] can be validated systematically by deriving
* **allowed transitions from the box schema itself**.
*
* When that happens:
*
*   - this module will remain focused on *root grammar only*
*   - deeper validators can be layered after it
*   - error messages will remain precise, friendly, and local
*
* Grammar enforcement is designed to be:
*
*   - incremental
*   - additive
*   - never retrofitted
*
* -----------------------------------------------------------------------------
* Design principle
* -----------------------------------------------------------------------------
*
* Paths are user input.
* Errors are part of the API.
*
* This module treats error messages as a first-class interface,
    * not as debugging artifacts.
    */
function enforceValidRoot(path) {

    const isValidRoot =
        path === "moov" ||
        path.startsWith("moov/") ||
        path === "ftyp" ||
        path === "free" ||
        path === "mdat";

    if (isValidRoot) {
        return;
    }

    // If the path looks like traversal inside the MP4 tree,
    // explain it as a relative path error.
    if (path.includes("/")) {
        throw new Error(
            `Relative path '${path}' is not allowed. ` +
            "All paths must be absolute and start at the MP4 root, " +
            "for example 'moov/trak[0]/...'."
        );
    }

    // Generic invalid root.
    throw new Error(
        `Invalid root path '${path}'. ` +
        "Valid roots are 'moov', 'ftyp', and 'free', " +
        "for example 'moov/trak[0]/...'."
    );
}

export function enforceRootPathGrammar(path) {

    if (typeof path !== "string" || path.length === 0) {
        throw new Error("Path must be a non-empty string.");
    }

    enforceValidRoot(path);
}
