import { asIsoBoxContainer } from "../../box-model/Box.js";
import { allowsIsoChildTraversal } from "../../box-schema/boxSchemas.js";
import { readUint32 } from "../../bytes/mp4ByteReader.js";
import { readFourCC } from "../../box-schema/boxLayoutReaders.js";

/**
 * BoxExtractor
 * ============
 *
 * Purpose
 * -------
 * Utilities for *structural extraction* of MP4 boxes and
 * box-like constructs.
 *
 * This module exists to support:
 *   - golden MP4 inspection
 *   - locked-layout equivalence tests
 *   - semantic rebuild verification
 *
 * It is NOT a general-purpose MP4 parser.
 *
 *
 * Architectural Boundary
 * ----------------------
 * All *generic* MP4 container traversal is delegated to the
 * container box model via:
 *
 *   asIsoBoxContainer(bytes)
 *
 * That abstraction is the single source of truth for:
 *   - where child traversal begins
 *   - whether a container is file-level, SimpleBox, or FullBox
 *
 * This module must not:
 *   - hardcode container offsets
 *   - branch on box names
 *   - infer header layouts
 *
 *
 * Intentional Exceptions
 * ----------------------
 * Not all structures that "contain children" in MP4 are ISO BMFF
 * container boxes.
 *
 * Two important examples:
 *
 * 1. SampleEntry boxes (e.g. avc1, mp4a)
 *    - Children begin after a fixed-format preamble
 *    - Layout is codec-specific
 *    - Not a SimpleBox or FullBox
 *
 * 2. stsd (Sample Description Box)
 *    - Contains a table of SampleEntry records
 *    - Entries are not child boxes in the normal sense
 *
 * These structures are:
 *   - intentionally handled by specialized helpers
 *   - explicitly fenced
 *   - not routed through asIsoBoxContainer
 *
 * This is a design choice, not an omission.
 *
 *
 * Responsibilities
 * ----------------
 * - Walk MP4 box trees using explicit type paths
 * - Extract raw child box bytes for tests
 * - Support SampleEntry-specific traversal where required
 *
 *
 * Non-Responsibilities
 * --------------------
 * - No decoding of codec payloads
 * - No interpretation of SPS/PPS
 * - No mutation of buffers
 * - No general MP4 parsing API
 *
 *
 * Design Rule (Non-Negotiable)
 * ----------------------------
 * If a structure can be traversed using asIsoBoxContainer,
 * it MUST be traversed using asIsoBoxContainer.
 *
 * Any helper that bypasses the container model
 * must justify its existence by structural necessity.
 */

/*
TRANSITIONAL MODULE NOTICE

This module currently mixes:
- ISO BMFF box traversal
- SampleEntry traversal
- Singular and plural access patterns

The traversal API is, though this itself is
under scrutiny. There are better patterns for this
- findBoxesByPathFromMp4

even findBoxesByPathFromMp4 bypasses a lot of checks
in the exractor
All singular extractors are transitional and will be removed.

This file is intentionally noisy to prevent silent architectural rot.
*/


// ------------------------------------------------------------
// Private low-level readers (STRUCTURAL intent)
// ------------------------------------------------------------

// ------------------------------------------------------------
// Public API
// ------------------------------------------------------------


/**
 * extractBoxByPath
 * ----------------
 *
 * Navigates an MP4 box tree using an explicit path of box types.
 *
 * This function performs *structural traversal only*.
 * It does not:
 *   - interpret semantics
 *   - infer container layouts
 *   - compute offsets manually
 *
 * All child discovery is delegated to the container box model.
 */
export function extractBoxByPathFromMp4(mp4Bytes, path) {

    throw new Error(
        "extractBoxByPathFromMp4 has been removed.\n\n" +
        "Reason:\n" +
        "- MP4 paths are plural by nature\n" +
        "- This API assumes singular results\n" +
        "- It bypasses semantic validation\n\n" +
        "What to use instead:\n" +
        "- For tests and semantic access:\n" +
        "  getSemanticBoxDataByPathFromMp4File()\n" +
        "- For raw discovery:\n" +
        "  findBoxesByPathFromMp4()\n\n" +
        "This change is intentional and forces explicit selection\n" +
        "and semantic interpretation."
    );

    const results = findBoxesByPathFromMp4(mp4Bytes, path);

    if (results.length !== 1) {
        throw new Error(
            "extractBoxByPathFromMp4: expected exactly one match.\n" +
            `Found ${results.length} for path '${path}'.\n` +
            "Use findBoxesByPathFromMp4 and select explicitly."
        );
    }

    return results[0];
}

export function extractChildBoxFromContainer(containerBytes, path, fourcc) {

    throw new Error(
        [
            "extractChildBoxFromContainer is deprecated and must not be used.",
            "",
            "Reason:",
            "- This helper bypasses the Golden Truth path resolution system.",
            "- It performs ad-hoc container traversal outside the registry.",
            "- This breaks the single-authority rule for MP4 structural access.",
            "",
            "Correct usage:",
            "- Use getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(...)",
            " or getGoldenTruthBox.getSemanticBoxDataByPathFromIsoBox(...)",
            "- Address child boxes via explicit structural paths",
            "- Let GoldenTruthPathResolver perform traversal",
            "",
            "Example:",
            "  getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(mp4Bytes, 'moov/trak[0]/mdia/minf/stbl/stsd')",
            "",
            "If you believe this helper is still required,",
            "that indicates a missing capability in the path resolver.",
            "Fix the resolver, do not revive this function."
        ].join("\n")
    );

    const container = asIsoBoxContainer(containerBytes, path);
    const child = container.enumerateChildren()
        .find(c => c.type === fourcc);

    if (!child) {
        throw new Error(`FAIL: child box '${fourcc}' not found`);
    }

    return containerBytes.slice(
        child.offset,
        child.offset + child.size
    );
}

/**
 * Sample Extraction API (Metadata)
 * --------------------------------
 *
 * extractIlstItemByKeyFromMp4
 * ==========================
 *
 * This function handles ILST traversal, which is NOT compatible with
 * the ISO container model and therefore does not belong to the MP4
 * Box Extraction API.
 *
 * Test-only structural extractor for individual ILST item boxes.
 *
 * ---------------------------------------------------------------------------
 * Why this function exists
 * ---------------------------------------------------------------------------
 *
 * The `ilst` box is NOT a standard ISO BMFF container.
 *
 * Although it *contains* child boxes, those children:
 *   - are not discoverable via generic container rules
 *   - do not begin at offsets that `asIsoBoxContainer` can determine
 *   - are keyed by dynamic FourCC values (e.g. "©nam", "©too")
 *
 * Attempting to traverse `ilst` using `asIsoBoxContainer` is incorrect and will
 * (correctly) fail.
 *
 * This function exists to make that exception EXPLICIT.
 *
 * ---------------------------------------------------------------------------
 * Architectural role
 * ---------------------------------------------------------------------------
 *
 * This helper performs *structural traversal only*.
 *
 * It:
 *   - linearly scans the ILST payload
 *   - locates an item by its dynamic FourCC key
 *   - returns the raw bytes of the matching item box
 *
 * It does NOT:
 *   - interpret metadata semantics
 *   - decode `data` payloads
 *   - normalize values
 *   - apply policy
 *   - assemble builders
 *
 * All semantic interpretation is delegated to golden truth extractors.
 *
 * ---------------------------------------------------------------------------
 * Relationship to Clean Architecture
 * ---------------------------------------------------------------------------
 *
 * This function intentionally lives at the *edge* of the system.
 *
 * It encodes MP4 format quirks that do not belong in:
 *   - box models
 *   - builders
 *   - emitters
 *   - production code
 *
 * By isolating this logic here, the core architecture remains:
 *   - honest
 *   - explicit
 *   - refactor-safe
 *
 * ---------------------------------------------------------------------------
 * Design rule (non-negotiable)
 * ---------------------------------------------------------------------------
 *
 * If a structure cannot be traversed via `asIsoBoxContainer`,
 * it MUST be handled by an explicit, purpose-built helper.
 *
 * Generalizing this logic or folding it into container traversal
 * would be architectural corruption.
 *
 * ---------------------------------------------------------------------------
 * Usage
* ---------------------------------------------------------------------------
*
* This function is intended for use by:
*   - golden truth extraction
*   - locked-layout equivalence tests
*
* It must NOT be used by:
*   - builders
*   - emitters
*   - production muxer code
*
* @param {Uint8Array} mp4Bytes
*   Full MP4 file bytes.
*
* @param {string} ilstPath
*   Path to the ilst box (e.g. "moov/udta/meta/ilst").
*
* @param {string} key
*   FourCC identifying the metadata item (e.g. "©too").
*
* @returns {Uint8Array}
*   Raw bytes of the matching ilst item box.
*
* @throws {Error}
*   If the ilst box or the requested item is not found.
*/
export function extractIlstItemByKeyFromMp4(mp4Bytes, ilstPath, key) {
    const ilstBox = extractBoxByPathFromMp4(mp4Bytes, ilstPath);

    if (!ilstBox) {
        throw new Error(`ilst not found at path '${ilstPath}'`);
    }

    let offset = 8; // skip ilst header

    while (offset + 8 <= ilstBox.length) {
        const size =
            (ilstBox[offset]     << 24) |
            (ilstBox[offset + 1] << 16) |
            (ilstBox[offset + 2] << 8)  |
            ilstBox[offset + 3];

        const type = readFourCC(ilstBox, offset + 4);

        if (type === key) {
            return ilstBox.slice(offset, offset + size);
        }

        if (size < 8) break;
        offset += size;
    }

    throw new Error(`ilst item '${key}' not found`);
}


export function extractChildBoxFromIlstItem(itemBytes, fourcc) {
    let offset = 8; // skip item header

    while (offset + 8 <= itemBytes.length) {
        const size =
            (itemBytes[offset]     << 24) |
            (itemBytes[offset + 1] << 16) |
            (itemBytes[offset + 2] << 8)  |
            itemBytes[offset + 3];

        const type = readFourCC(itemBytes, offset + 4);

        if (type === fourcc) {
            return itemBytes.slice(offset, offset + size);
        }

        if (size < 8) break;
        offset += size;
    }

    throw new Error(`ilst item missing child '${fourcc}'`);
}

/**
 * findBoxesByPathFromMp4
 * =====================
 *
 * Structural discovery utility for plural MP4 paths.
 *
 * This function exists solely to discover *how many* boxes exist at a given
 * structural path when cardinality is unknown or unbounded.
 *
 * WHAT IT DOES:
 * - Walks the MP4 structure
 * - Locates all boxes matching the given path expression
 * - Returns their raw structural box representations
 *
 * WHAT IT DOES NOT DO:
 * - Does NOT interpret semantics
 * - Does NOT validate against schemas
 * - Does NOT generate emitter intent
 * - Does NOT extract authoritative box data
 *
 * IMPORTANT:
 * - MP4 paths are plural by nature
 * - Discovery and interpretation are separate concerns
 *
 * AUTHORITY:
 * - Structural only
 * - Non-authoritative
 *
 * For semantic access or raw byte extraction of a *known* box:
 * - Use Golden Truth extractor APIs
 *
 * For schema-aware traversal and validation:
 * - Use the extractor registry
 *
 * This function should disappear once schema-driven plural traversal
 * is fully handled by the extractor layer.
 */
export function findBoxesByPathFromMp4(mp4Bytes, path) {
    if (!(mp4Bytes instanceof Uint8Array)) {
        throw new Error("findBoxesByPathFromMp4: expected Uint8Array");
    }

    if (typeof path !== "string" || path.length === 0) {
        throw new Error("findBoxesByPathFromMp4: path must be a non-empty string");
    }

    const segments = path.split("/");

    let current = [{
        bytes: mp4Bytes,
        registryPath: "$mp4"
    }];

    for (const segment of segments) {
        const next = [];

        for (const { bytes, registryPath } of current) {
            const container =
                asIsoBoxContainer(bytes, registryPath);

            const children = container.enumerateChildren();


            for (const child of children) {
                if (child.type !== segment) {
                    continue;
                }

                // ISO grammar enforcement happens here
                if (!allowsIsoChildTraversal(registryPath)) {
                    throw new Error(
                        `Invalid traversal: '${segment}' is not a child box of '${registryPath}'`
                    );
                }

                const childBytes =
                    bytes.slice(
                        child.offset,
                        child.offset + child.size
                    );

                next.push({
                    bytes: childBytes,
                    registryPath:
                    registryPath === "$mp4"
                    ? segment
                    : `${registryPath}/${segment}`
                });
            }

        }


        if (next.length === 0) {
            return [];
        }

        current = next;
    }

    return current.map(n => n.bytes);
}

