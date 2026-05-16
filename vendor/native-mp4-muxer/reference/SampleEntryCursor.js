// SampleEntryCursor.js
//
// A structural cursor for MP4 SampleEntries.
//
// -----------------------------------------------------------------------------
// Why this file exists
// -----------------------------------------------------------------------------
//
// In the ISO Base Media File Format (MP4), most structures are "boxes":
//
//   [ size ][ type ][ payload ... ]
//
// These boxes form a recursive container hierarchy.
// They all follow the same rules:
//   - size and type at offset 0
//   - children begin immediately after the header
//   - traversal can be generic and schema-agnostic
//
// SampleEntries are different.
//
// A SampleEntry is NOT an ISO container box.
//
// It deliberately breaks the normal MP4 box model.
//
// -----------------------------------------------------------------------------
// What a SampleEntry actually is
// -----------------------------------------------------------------------------
//
// A SampleEntry describes how the samples in a track are encoded.
// It does not contain media samples themselves.
// It is a *descriptor*, not a container.
//
// Byte layout (conceptually):
//
//   [ size ][ type ][ codec-owned header ][ child boxes ... ]
//
// Key differences from normal boxes:
//
//   • The header is NOT uniform
//   • The header length is codec-specific
//     - avc1 (video) ≠ mp4a (audio)
//   • The header contains inline fields, not nested boxes
//   • Child boxes do NOT start at offset 8
//
// The codec specification — not ISO — defines the header layout.
//
// This means:
//
//   Treating a SampleEntry as a normal container box is incorrect.
//   Using generic ISO traversal inside a SampleEntry is a bug.
//
// -----------------------------------------------------------------------------
// Why generic MP4 traversal fails here
// -----------------------------------------------------------------------------
//
// Generic MP4 traversal assumes:
//
//   childrenOffset = 8
//
// That assumption is false for SampleEntries.
//
// Child boxes begin at:
//
//   8 + SampleEntryHeaderSize
//
// And SampleEntryHeaderSize:
//
//   • depends on the codec
//   • is defined outside the ISO box model
//   • cannot be inferred safely at runtime
//
// Mixing SampleEntry traversal into the normal box model causes:
//
//   • off-by-N errors
//   • codec leakage into generic code
//   • accidental semantic parsing
//   • architectural boundary violations
//
// -----------------------------------------------------------------------------
// Architectural role of SampleEntryCursor
// -----------------------------------------------------------------------------
//
// This module formalizes a missing architectural concept:
//
//   “Traversal without interpretation”
//
// A SampleEntryCursor:
//
//   • represents ONE already-selected SampleEntry
//   • operates on raw bytes only
//   • enables structural child traversal (avcC, esds, btrt, pasp, etc.)
//   • requires the caller to supply the correct header size
//
// It deliberately does NOT:
//
//   • parse width, height, sampleRate
//   • interpret codec semantics
//   • decide which codec is in use
//   • call avc1 / mp4a extractors
//   • return emitter or builder parameters
//   • interact with registries, dispatchers, or resolvers
//
// -----------------------------------------------------------------------------
// Clean Architecture boundary
// -----------------------------------------------------------------------------
//
// Responsibilities are intentionally separated:
//
//   • Resolvers choose *where* to look (paths, indices)
//   • Cursors enable *movement* through irregular structure
//   • Extractors decide *what it means*
//
// SampleEntryCursor sits strictly in the middle.
//
// It exists because SampleEntries are:
//
//   • codec-owned
//   • externally specified
//   • structurally irregular
//   • not valid ISO containers
//
// This cursor makes that irregularity explicit,
// instead of hiding it behind architectural lies.
//
// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
//
// SampleEntryCursor exists because SampleEntries are not MP4 boxes.
//
// They require different traversal rules.
// Those rules must live somewhere.
// This file is that place.
//
import { readUint32 } from "../bytes/mp4ByteReader.js";
import { readFourCC } from "../box-schema/boxLayoutReaders.js";

/**
 * SampleEntryCursor
 * =================
 *
 * A lightweight, immutable cursor over a SampleEntry byte region.
 *
 * The cursor exposes:
 * - raw bytes
 * - the SampleEntry fourcc (avc1, mp4a, etc.)
 * - structural child traversal
 *
 * It deliberately does NOT:
 * - parse width, height, sampleRate
 * - validate codec-specific layouts
 * - decide which extractor applies
 *
 * Those responsibilities belong elsewhere.
 */
export class SampleEntryCursor {

    constructor(sampleEntryBytes) {
        if (!(sampleEntryBytes instanceof Uint8Array)) {
            throw new Error(
                "SampleEntryCursor: expected Uint8Array"
            );
        }

        if (sampleEntryBytes.length < 8) {
            throw new Error(
                "SampleEntryCursor: buffer too small to be a SampleEntry"
            );
        }

        this.bytes = sampleEntryBytes;

        // FourCC is always at offset 4 in SampleEntry
        this.type = readFourCC(sampleEntryBytes, 4);
    }

    /**
     * getType()
     * ---------
     *
     * Returns the SampleEntry fourcc (avc1, mp4a, etc.)
     *
     * This is informational only.
     * It must NOT be used to infer semantics here.
     */
    getType() {
        return this.type;
    }

    /**
     * getBytes()
     * ----------
     *
     * Returns the raw SampleEntry bytes.
     *
     * Used by higher layers when handing control to
     * codec-specific extractors.
     */
    getBytes() {
        return this.bytes;
    }

    /**
     * getChildBox(fourcc)
     * -------------------
     *
     * Structurally locates a direct child box inside the SampleEntry.
     *
     * This method:
     * - performs byte-level scanning only
     * - does NOT assume ISO container semantics
     * - does NOT recurse
     *
     * Child offsets are calculated using the SampleEntry header size,
     * which differs between audio and video SampleEntries.
     *
     * IMPORTANT:
     * The caller must supply the correct header size.
     * This cursor does not guess or infer it.
     */
    getChildBox({ headerSize, fourcc }) {

        if (!Number.isInteger(headerSize) || headerSize < 0) {
            throw new Error(
                "SampleEntryCursor.getChildBox: invalid headerSize"
            );
        }

        if (typeof fourcc !== "string" || fourcc.length !== 4) {
            throw new Error(
                "SampleEntryCursor.getChildBox: fourcc must be 4 characters"
            );
        }

        const bytes = this.bytes;

        // Child boxes begin after:
        //   size (4) + type (4) + SampleEntry header
        let offset = 8 + headerSize;

        while (offset + 8 <= bytes.length) {

            const size = readUint32(bytes, offset);
            const type = readFourCC(bytes, offset + 4);

            if (size < 8) {
                break;
            }

            if (type === fourcc) {
                return bytes.slice(offset, offset + size);
            }

            offset += size;
        }

        return null;
    }

    /**
     * listChildren()
     * --------------
     *
     * Enumerates all direct child boxes of this SampleEntry.
     *
     * This is a structural listing only.
     * Returned objects contain:
     * - type
     * - offset
     * - size
     *
     * No interpretation is performed.
     */
    listChildren({ headerSize }) {

        if (!Number.isInteger(headerSize) || headerSize < 0) {
            throw new Error(
                "SampleEntryCursor.listChildren: invalid headerSize"
            );
        }

        const bytes = this.bytes;
        const children = [];

        let offset = 8 + headerSize;

        while (offset + 8 <= bytes.length) {

            const size = readUint32(bytes, offset);
            const type = readFourCC(bytes, offset + 4);

            if (size < 8) {
                break;
            }

            children.push({
                type,
                offset,
                size
            });

            offset += size;
        }

        return children;
    }
}
