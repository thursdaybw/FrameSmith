import { asContainer } from "../../box-model/Box.js";
import { readFourCC } from "../../bytes/mp4ByteReader.js";

/**
 * BoxExtractor
 * ============
 *
 * Purpose
 * -------
 * Test-only utilities for *structural extraction* of MP4 boxes and
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
 *   asContainer(bytes)
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
 *   - not routed through asContainer
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
 * If a structure can be traversed using asContainer,
 * it MUST be traversed using asContainer.
 *
 * Any helper that bypasses the container model
 * must justify its existence by structural necessity.
 */


// ------------------------------------------------------------
// Private low-level readers (STRUCTURAL intent)
// ------------------------------------------------------------

/**
 * Reads a big-endian unsigned 32-bit integer from a byte buffer.
 *
 * This is a low-level structural helper used only for:
 * - MP4 box size fields
 * - table entry sizes
 *
 * No bounds checking is performed.
 * Callers must ensure the offset is valid.
 */
function readUint32(buffer, offset) {
    return (
        (buffer[offset]     << 24) |
        (buffer[offset + 1] << 16) |
        (buffer[offset + 2] << 8)  |
        buffer[offset + 3]
    ) >>> 0;
}

// ------------------------------------------------------------
// Core traversal helpers (PRIVATE)
// ------------------------------------------------------------

/**
 * Scans child boxes inside a SampleEntry payload.
 *
 * IMPORTANT:
 * ----------
 * This function is NOT a general MP4 container traversal helper.
 *
 * SampleEntry boxes (e.g. avc1, mp4a) embed child boxes after a
 * fixed-format, codec-defined preamble.
 *
 * This violates the assumptions of the container box model and
 * therefore MUST NOT use asContainer.
 *
 * Enforcement:
 * ------------
 * - This function validates that the input is a SampleEntry
 * - It is not exported
 * - It is used only by extractChildBoxFromSampleEntry
 *
 * If you think you need this function elsewhere, you are
 * probably violating the architecture.
 */
function scanVisualSampleEntryChildBoxes(sampleEntryBox, startOffset, fourcc) {
    // Structural guard only: ensures child scan is possible
    if (sampleEntryBox.length < startOffset + 8) {
        throw new Error(
            "scanVisualSampleEntryChildBoxes: invalid VisualSampleEntry layout"
        );
    }

    let offset = startOffset;

    while (offset + 8 <= sampleEntryBox.length) {
        const size = readUint32(sampleEntryBox, offset);
        const childType = readFourCC(sampleEntryBox, offset + 4);

        if (childType === fourcc) {
            return sampleEntryBox.slice(offset, offset + size);
        }

        if (size < 8) break;
        offset += size;
    }

    throw new Error(`FAIL: child box '${fourcc}' not found`);
}


function extractChildBoxFromSampleEntry(sampleEntryBox, fourcc) {
    const sampleEntryType = readFourCC(sampleEntryBox, 4);

    if (sampleEntryType !== "avc1") {
        throw new Error(
            `Unsupported SampleEntry type '${sampleEntryType}'`
        );
    }

    const childrenOffset = 8 + 78;
    return scanVisualSampleEntryChildBoxes(sampleEntryBox, childrenOffset, fourcc);
}

/**
 * Extracts a specific SampleEntry from an stsd box.
 *
 * stsd is NOT a generic container:
 * - it contains a count-prefixed table
 * - entries are not child boxes in the normal sense
 *
 * This function intentionally does not use asContainer.
 */
function extractSampleEntry(stsdBox, fourcc) {
    // stsd layout:
    // size (4)
    // type (4)
    // version (1)
    // flags (3)
    // entry_count (4)

    let offset = 16;

    const entryCount =
        (stsdBox[12] << 24) |
        (stsdBox[13] << 16) |
        (stsdBox[14] << 8)  |
        stsdBox[15];

    for (let i = 0; i < entryCount; i++) {
        const size = readUint32(stsdBox, offset);
        const type = readFourCC(stsdBox, offset + 4);

        if (type === fourcc) {
            return stsdBox.slice(offset, offset + size);
        }

        offset += size;
    }

    throw new Error(
        `FAIL: sample entry '${fourcc}' not found in stsd`
    );
}

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
  if (!(mp4Bytes instanceof Uint8Array)) {
    throw new Error("extractBoxByPathFromMp4: expected Uint8Array");
  }

  if (typeof path !== "string" || path.length === 0) {
    throw new Error(
      "extractBoxByPathFromMp4: path must be a non-empty string like 'moov/trak/mdia/hdlr'"
    );
  }

  const segments = path.split("/");

  if (segments.some(s => s.length === 0)) {
    throw new Error(
      `extractBoxByPathFromMp4: invalid path '${path}'`
    );
  }

  let currentBytes = mp4Bytes;

  for (const segment of segments) {
    const container = asContainer(currentBytes);
    const children = container.enumerateChildren();

    const match = children.find(c => c.type === segment);

    if (!match) {
      return null; // or throw, depending on your contract
    }

    currentBytes = currentBytes.slice(
      match.offset,
      match.offset + match.size
    );
  }

  return currentBytes;
}

/**
 * Extracts a SampleEntry from an MP4 using an explicit stsd path.
 *
 * This is the ONLY supported way to extract SampleEntry boxes.
 *
 * @param {Uint8Array} mp4Bytes
 * @param {string} stsdPath - e.g. "moov/trak/mdia/minf/stbl/stsd"
 * @param {string} fourcc   - e.g. "avc1"
 *
 * @returns {Uint8Array}
 */
export function extractSampleEntryFromMp4(mp4Bytes, stsdPath, fourcc) {
    const stsdBox = extractBoxByPathFromMp4(mp4Bytes, stsdPath);

    if (!stsdBox) {
        throw new Error(
            `extractSampleEntryFromMp4: stsd not found at path '${stsdPath}'`
        );
    }

    return extractSampleEntry(stsdBox, fourcc);
}

/**
 * Extract a nested box by path starting from a container box.
 *
 * Example:
 *   extractBoxByPathFromBox(stblBytes, ["stsd"])
 *   extractBoxByPathFromBox(metaBytes, ["hdlr"])
 *
 * Contract:
 * - boxBytes MUST be a valid MP4 box (Uint8Array)
 * - Traversal starts at this box's children
 * - Path elements refer to child box types
 */
export function extractBoxByPathFromBox(boxBytes, path) {
    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error(
            "extractBoxByPathFromBox: expected Uint8Array"
        );
    }

    if (typeof path !== "string" || path.length === 0) {
        throw new Error(
            "extractBoxByPathFromBox: path must be a non-empty string"
        );
    }

    const segments = path.split("/");

    let currentBytes = boxBytes;

    for (const segment of segments) {
        const container = asContainer(currentBytes);
        const children  = container.enumerateChildren();

        const match = children.find(c => c.type === segment);

        if (!match) {
            throw new Error(
                `extractBoxByPathFromBox: Missing box '${segment}' in path '${path}'`
            );
        }

        currentBytes = currentBytes.slice(
            match.offset,
            match.offset + match.size
        );
    }

    return currentBytes;
}

export function extractChildBoxFromContainer(containerBytes, fourcc) {
    const container = asContainer(containerBytes);
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
 * Finds all byte offsets where a fourcc appears in a buffer.
 *
 * This is a diagnostic utility only.
 * It does not imply structural validity.
 */
export function findFourCC(buffer, fourcc) {
    const codes = fourcc.split("").map(c => c.charCodeAt(0));
    const hits = [];

    for (let i = 0; i < buffer.length - 3; i++) {
        if (
            buffer[i]     === codes[0] &&
            buffer[i + 1] === codes[1] &&
            buffer[i + 2] === codes[2] &&
            buffer[i + 3] === codes[3]
        ) {
            hits.push(i);
        }
    }

    return hits;
}

/**
 * extractIlstItemByKeyFromMp4
 * ==========================
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
 *   - do not begin at offsets that `asContainer` can determine
 *   - are keyed by dynamic FourCC values (e.g. "©nam", "©too")
 *
 * Attempting to traverse `ilst` using `asContainer` is incorrect and will
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
 * If a structure cannot be traversed via `asContainer`,
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
 * DEPRECATED: extractChildBoxFromSampleEntry
 * -----------------------------------------
 *
 * This function no longer exists as a public API.
 *
 * SampleEntry traversal is now:
 *   - owned by parsers
 *   - handled via getParsedBox
 *   - or routed through extractSampleEntryFromMp4
 *
 * This export exists ONLY to prevent test harness
 * load failures during parser migration.
 *
 * Any call to this function is a bug.
 */
export function __DEPRECATED_extractChildBoxFromSampleEntry() {
    throw new Error(
        "DEPRECATED API: extractChildBoxFromSampleEntry\n\n" +
        "This function has been removed.\n\n" +
        "SampleEntry traversal must NOT be done directly.\n\n" +
        "Use one of the following instead:\n" +
        "  - getParsedBox.fromMp4(...)\n" +
        "  - getParsedBox.fromBox(...)\n" +
        "  - extractSampleEntryFromMp4(...) (tests only)\n\n" +
        "See:\n" +
        "  src/mux/native/tests/parsers/README.md\n"
    );
}

/**
 * DEPRECATED SHIM — extractSampleEntry
 * -----------------------------------
 *
 * This function is no longer part of the public API.
 *
 * SampleEntry extraction must now be performed via:
 *   - extractSampleEntryFromMp4(...)
 *   - or parser-owned logic via getParsedBox
 *
 * This export exists only to keep the test harness loading
 * during the parser migration.
 */
export function __DEPRECATED_extractSampleEntry() {
    throw new Error(
        "DEPRECATED API: extractSampleEntry\n\n" +
        "This function has been removed from the public API.\n\n" +
        "Use one of:\n" +
        "  - extractSampleEntryFromMp4(mp4Bytes, stsdPath, fourcc)\n" +
        "  - getParsedBox.fromMp4(...)\n\n" +
        "See src/mux/native/tests/parsers/README.md"
    );
}

