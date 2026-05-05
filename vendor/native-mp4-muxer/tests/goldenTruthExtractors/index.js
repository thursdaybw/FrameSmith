/**
 * Golden Truth Extractors — System Overview
 * ========================================
 *
 * This module is the composition root for the Golden Truth extraction system.
 *
 * It defines:
 *   - the path grammar used to address MP4 structure
 *   - the boundary between structural traversal and semantic interpretation
 *   - the dispatcher model that resolves concrete paths to canonical extractors
 *
 * This file intentionally contains the *authoritative narrative* for the system.
 * Other modules document only their local responsibilities.
 *
 * ---------------------------------------------------------------------------
 * What this system is
 * ---------------------------------------------------------------------------
 *
 * Golden Truth extractors provide a deterministic, structural view of MP4 files.
 * They are designed to evolve into a general-purpose demuxer layer.
 *
 * Paths address bytes.
 * Semantics are layered on top.
 *
 *
 * ---------------------------------------------------------------------------
 * Design note: extractor authority and getEmitterInput
 * ---------------------------------------------------------------------------
 *
 * Each Golden Truth extractor exposes two distinct operations:
 *
 *   - readBoxReport(boxBytes)
 *   - getEmitterInput(...)
 *
 * readBoxReport performs structural interpretation of raw bytes.
 * It defines how a box is understood in terms of fields, children,
 * and schema-aligned shape.
 *
 * getEmitterInput is a TEST-ONLY adapter whose sole purpose is to
 * extract semantic intent in a form that can be passed directly into
 * the assembly layer for round-trip verification.
 *
 * ---------------------------------------------------------------------------
 * Important limitation (intentional)
 * ---------------------------------------------------------------------------
 *
 * Today, getEmitterInput may receive raw boxBytes and is therefore
 * technically capable of performing its own traversal or resolution.
 *
 * No existing test can prove whether getEmitterInput consumed only
 * data derived from readBoxReport or bypassed it entirely.
 *
 * This is acceptable because:
 *
 *   - getEmitterInput is not a production API
 *   - its role is verification, not authority
 *   - the correctness criterion is byte-level equivalence
 *
 * If the rebuilt bytes match the oracle, the verification succeeds,
 * regardless of how the intent was extracted.
 *
 * ---------------------------------------------------------------------------
 * Structural inconsistency is not accidental
 * ---------------------------------------------------------------------------
 *
 * Not all MP4 boxes admit uniform structural reporting.
 *
 * In particular:
 *   - SampleEntry boundaries (stsd, avc1, mp4a, etc.)
 *   - metadata atoms (ilst and children)
 *
 * require eager interpretation and often surface populated child data
 * directly, while most ISO containers report only child presence and
 * defer traversal.
 *
 * This inconsistency reflects the MP4 specification itself and is
 * intentionally preserved.
 *
 * ---------------------------------------------------------------------------
 * Considered improvement (deferred)
 * ---------------------------------------------------------------------------
 *
 * A stricter contract would pass the result of readBoxReport directly
 * into getEmitterInput, rather than raw boxBytes.
 *
 * Under that model:
 *   - readBoxReport becomes the single structural interpreter
 *   - getEmitterInput consumes interpreted structure only
 *   - secondary traversal becomes impossible by construction
 *
 * This would harden extractor boundaries and eliminate an entire class
 * of accidental bypasses.
 *
 * The change is deferred because getEmitterInput exists solely for
 * verification, and the current design is sufficient provided this
 * boundary remains consciously managed.
 *
 * This note documents intent so that future refactors do not erode it
 * unintentionally.
 *
 * ---------------------------------------------------------------------------
 * Path grammar (normative)
 * ---------------------------------------------------------------------------
 *
 * Paths are structural and hierarchical, matching the MP4 box layout.
 *
 * Example (input path):
 *
 *     moov/trak[0]/mdia/minf/stbl/stsd/avc1/pasp
 *
 * Rules:
 *   - All plural containers MUST be indexed (e.g. trak[n])
 *   - Paths never encode semantic meaning (no "video", no "audio")
 *   *mpo/
 *   - Paths never select by inference or fallback
 *
 * Input paths address concrete instances.
 * Registry paths describe canonical structure.
 *
 * ---------------------------------------------------------------------------
 * Input paths vs registry paths
 * ---------------------------------------------------------------------------
 *
 * Input path:
 *   moov/trak[0]/mdia/minf/stbl/stsd/avc1/pasp
 *
 * Registry path:
 *   moov/trak/mdia/minf/stbl/stsd/avc1/pasp
 *
 * The dispatcher:
 *   - resolves indexed segments
 *   - selects the concrete byte ranges
 *   - strips instance qualifiers
 *   - performs registry lookup
 *
 * ---------------------------------------------------------------------------
 * Track selection and handler types
 * ---------------------------------------------------------------------------
 *
 * Track selection is purely structural and performed via trak[n].
 *
 * The handler box (mdia/hdlr):
 *   - is NOT used to select tracks
 *   - IS used to interpret schemas once a track is selected
 *
 * trak[n] answers: "which track?"
 * hdlr     answers: "how do I interpret boxes in this track?"
 *
* ---------------------------------------------------------------------------
       * STSD and SampleEntry traversal
       * ---------------------------------------------------------------------------
       *
       * There is exactly one stsd box per track.
       * It contains one or more SampleEntry boxes (avc1, mp4a, ...).
       *
       * Traversal into SampleEntries is structural:
       *
       *     moov/trak[n]/mdia/minf/stbl/stsd/avc1
       *
       * Child boxes are addressed directly:
       *
       *     .../avc1/avcC
       *     .../mp4a/esds
       *
       * The dispatcher may refine paths,
       * but must never collapse abstraction layers.
       *
       * ---------------------------------------------------------------------------
       * Module responsibilities
       * ---------------------------------------------------------------------------
       *
       * - GoldenTruthPathResolver:
       *     Resolves (mp4Bytes, path) → concrete box bytes + containing track
       *
       * - GoldenTruthRegistry:

       *
       * - GoldenTruthFinalizer:
       *     Executes dispatchers and builds the GoldenTruth facade
       *
       * - index.js (this file):
           *     Orchestrates composition and exposes the public API
                 *
                 * ---------------------------------------------------------------------------
                 * Non-goals
                 * ---------------------------------------------------------------------------
                 *
                 * - No inference
                 * - No fallback across tracks
                 * - No semantic selectors in paths
                 * - No policy encoded in traversal
                 */
import {
    extractBoxByPathFromMp4,
} from "../reference/BoxExtractor.js";

import {
    asIsoBoxContainer,
} from "../../box-model/Box.js";

import { readFourCC } from "../../box-schema/boxLayoutReaders.js";

import { GoldenTruthRegistry }
from "./GoldenTruthRegistry.js";

import {
    findTraversalNodesByPathFromBoxBytes,
} from "./GoldenTruthPathResolver.js";

import { GoldenTruthFinalizer } from "./GoldenTruthFinalizer.js";

import { registerGoldenTruthExtractors }
from "./registerGoldenTruthExtractors.js";

import {
    stripBracketSelectors ,
    stripTrailingSlash,
} from "./sanitizeRegistryPath.js";

import { getBoxSchemaForPath } from "../../box-schema/boxSchemas.js";
import { createIsoTraversalRequestFromBoxAndPath} from "./createIsoTraversalRequestFromBoxAndPath.js";

import { getSampleEntryTableFromStsdAsList } from "../../reference/getSampleEntryTableFromStsdAsList.js";

import { SampleEntryCursor } from "../..//reference/SampleEntryCursor.js";
import {
    getSampleEntryHeaderSize,
    SampleEntryReader
} from "../../reference/SampleEntryReader.js";

import { IsoBoxNotFoundError } from "./errors.js";

export const SEMANTIC_VALIDATORS = {
    "moov/trak/mdia/minf": validateMinfByHandlerType,
};

// -----------------------------------------------------------------------------
// Registry population (composition root)
// -----------------------------------------------------------------------------

registerGoldenTruthExtractors(GoldenTruthRegistry);

/**
 * Public API — Golden Truth Extraction
 *
 * Usage:
 *   getGoldenTruthBox.fromMp4(mp4Bytes, path, options?)
 *
 * Path rules:
 *   - Paths follow MP4 box hierarchy using '/'
 *   - All plural boxes MUST be indexed (e.g. trak[0])
 *   - Indices select concrete instances only
 *   - Indices are stripped before extractor lookup
 *
 * Example:
 *   Input:
 *     moov/trak[0]/mdia/minf/stbl/stsd/avc1
 *
 *   Registry lookup:
 *     moov/trak/mdia/minf/stbl/stsd/avc1
 *
 * Track rules:
 *   - trak[n] selects which track
 *   - mdia/hdlr determines how that track is interpreted
 *
 * Detailed traversal logic:
 *   - GoldenTruthPathResolver.js
 *   - stsd.goldenTruthDispatcher.js
 */
export const getGoldenTruthBox = {

    /**
     *  *Input: bytes of any ISO container (moov, trak, mdia, minf, stbl, etc.)
     * 
     * Requires sourceRegistryKey to identify what those bytes represent
     * 
     * Traversal: yes
     * 
     * Target path: absolute MP4 path (not “relative”, but global identity)
     * 
     * Special case: identity resolution when targetBoxPath === sourceRegistryKey
     */
    getSemanticBoxDataFromBox({ boxBytes, sourceRegistryKey, targetBoxPath }) {

        validateGetSemanticBoxDataFromBoxArgs({
            boxBytes,
            sourceRegistryKey,
            targetBoxPath
        });

        // ---------------------------------------------------------
        // Identity resolution: the bytes already represent the target box
        // ---------------------------------------------------------
        if (targetBoxPath === sourceRegistryKey) {
            return GoldenTruthFinalizer.buildFacade({
                registryPath: sourceRegistryKey,
                bytes: boxBytes
            });
        }

        // ---------------------------------------------------------
        // MP4 root handling ($mp4)
        // ---------------------------------------------------------
        if (sourceRegistryKey === "$mp4") {

            let rootBox;
            const slashIndex = targetBoxPath.indexOf("/");

            if (slashIndex === -1) {
                rootBox = targetBoxPath;
            } else {
                rootBox = targetBoxPath.slice(0, slashIndex);
            }

            const result = resolveTopLevelMp4Box(boxBytes, rootBox);

            if (!result.exists) {
                throw new Error(
                    `Top-level box '${rootBox}' not found in MP4`
                );
            }

            return getGoldenTruthBox.getSemanticBoxDataFromBox({
                boxBytes: result.boxBytes,
                sourceRegistryKey: rootBox,
                targetBoxPath: targetBoxPath
            });
        }

        const isAbsoluteMp4Path =
            targetBoxPath.startsWith("moov") ||
            targetBoxPath.startsWith("ftyp") ||
            targetBoxPath.startsWith("free") ||
            targetBoxPath.startsWith("mdat");

        if (sourceRegistryKey === "$mp4" && !isAbsoluteMp4Path) {
            throw new Error(
                "Relative traversal is not supported.\n" +
                "Traversal paths must be absolute and start at an MP4 root box\n" +
                "(moov, ftyp, free, or mdat)."
            );
        }

        // ---------------------------------------------------------
        // Reject internal grammar in user input
        // ---------------------------------------------------------
        if (targetBoxPath.includes("|")) {
            throw new Error(
                [
                    "Invalid path syntax.",
                    "",
                    "SampleEntries must be addressed using sample[n] selectors.",
                    "",
                    "The '|' character is internal and must not appear in input paths.",
                    "",
                    "Why this is invalid:",
                    "  '|' is used internally to represent resolved SampleEntry identities.",
                    "  It is never written by users.",
                    "",
                    "How to fix this:",
                    "  Address SampleEntries explicitly using sample[n].",
                    "",
                    "Correct examples:",
                    "  moov/trak[0]/mdia/minf/stbl/stsd/sample[0]",
                    "  moov/trak[0]/mdia/minf/stbl/stsd/sample[0]/avcC"
                ].join('\n')
            );
        }

        // Grammar → indices
        // At this point we know:
        // - trackIndex (or not)
        // - sampleIndex (or not)
        // - remainingTraversalPath
        // - identity is not resolved
        // Nothing structural has happened yet.
        const traversalRequest = createIsoTraversalRequestFromBoxAndPath({
            sourceBoxBytes: boxBytes,
            sourceRegistryKey,
            targetBoxPath,
        });

        // Structural discovery
        // This section answers questions. It must not “advance state”.
        // Think of it as probing the file.

        let trakBytes = null;
        let stsdBytes = null;

        if (traversalRequest.trackIndex !== null) {

            const trakResult = resolveTrakBytesFromTraversalRequest(traversalRequest);

            if (!trakResult.found) {
                return { found: false };
            }

            trakBytes = trakResult.bytes;

            // make available to semantic validators
            traversalRequest.trakBytes = trakBytes;
        }

        // Exact-context stsd: reuse provided bytes
        if (
            traversalRequest.sampleIndex !== null &&
            sourceRegistryKey === "moov/trak/mdia/minf/stbl/stsd"
        ) {
            stsdBytes = boxBytes;
        }
        else if (trakBytes && traversalRequest.sampleIndex !== null) {
            stsdBytes = getGoldenTruthBox.getSemanticBoxDataFromBox({
                boxBytes: trakBytes,
                sourceRegistryKey: "moov/trak",
                targetBoxPath: "moov/trak/mdia/minf/stbl/stsd"
            }).readBoxReport().raw;
        }

        if (trakBytes && traversalRequest.sampleIndex !== null) {
            stsdBytes = getGoldenTruthBox.getSemanticBoxDataFromBox({
                boxBytes: trakBytes,
                sourceRegistryKey: "moov/trak",
                targetBoxPath: "moov/trak/mdia/minf/stbl/stsd"
            }).readBoxReport().raw;
        }

        // Identity resolution
        // -------------------------------
        // THIS is where:
        // - we inspect stsdBytes
        // - we inspect sampleIndex
        // - we inspect remainingTraversalPath
        // - we decide the registry key
        // - we mutate traversalRequest.targetBoxIdentity
        //
        // Nothing above this line mutates identity.
        // Nothing below this line does discovery.
        resolveTargetBoxIdentityFromStructure(traversalRequest, { stsdBytes });

        runSemanticValidators(traversalRequest);

        const isAbsoluteMp4Path2 =
            targetBoxPath.startsWith("moov") ||
            targetBoxPath.startsWith("ftyp") ||
            targetBoxPath.startsWith("free") ||
            targetBoxPath.startsWith("mdat");

        // ---------------------------------------------------------
        // Semantic guard: forbid sample[n] after sample-entry boundary
        // ---------------------------------------------------------
        if (
            traversalRequest.sampleIndex !== null &&
            registryKeyCrossesSampleEntryBoundary(traversalRequest.targetBoxIdentity.key) &&
            !isAbsoluteMp4Path2
        ) {
            throw new Error(
                [
                    "Invalid path for the current context.",
                    "",
                    "You are already inside a specific sample entry, so selecting another sample by index is not allowed.",
                    "",
                    "Current context:",
                    `  sourceRegistryKey = "${traversalRequest.targetBoxIdentity.key}"`,
                    "",
                    "Invalid path:",
                    `  ${targetBoxPath}`,
                    "",
                    "Why this is invalid:",
                    "  sample[n] can only be used when starting from 'stsd'.",
                    "  Once you have crossed into a SampleEntry, indexing no longer applies.",
                    "",
                    "Correct examples:",
                    "  moov/trak/mdia/minf/stbl/stsd/sample[0]/dOps",
                    "  moov/trak/mdia/minf/stbl/stsd/sample[0]/avcC",
                ].join("\n")
            );
        }


        if (registryKeyCrossesSampleEntryBoundary(traversalRequest.targetBoxIdentity.key)) {
            return resolveSampleEntryBoundaryFromTraversalRequest({
                traversalRequest,
                stsdBytes,
            });
        }

        const extractor = lookupExtractorByRegistryKey(traversalRequest.targetBoxIdentity.key);

        return resolveIsoBoxAndCreateSemanticBoxData(
            traversalRequest,
            extractor
        );
    },

    /**
     * Input: full MP4 bytes
     *
     * Path: absolute MP4 path
     *
     * Traversal: yes
     *
     * Identity: implicit (root is the MP4)
     *
     * Scope: entire file
     */
    getSemanticBoxDataByPathFromMp4File(mp4Bytes, path) {
        const result = getGoldenTruthBox.getSemanticBoxDataFromBox({
            boxBytes: mp4Bytes,
            sourceRegistryKey: "$mp4",
            targetBoxPath: path,
        });

        return result;
    },

    /**
     * Input: terminal box bytes
     * 
     * No traversal
     * 
     * Registry path required (explicit or inferred)
     * 
     * Purpose: extractor binding only
     */
    getSemanticBoxDataFromLeafBoxWithRegistryPath(boxBytes, explicitRegistryKey) {

        throw new Error(
            [
                "getSemanticBoxDataFromLeafBoxWithRegistryPath has been retired.",
                "",
                "This function tried to guess a box’s identity using only raw leaf bytes.",
                "That is no longer allowed.",
                "",
                "Why:",
                "  A FourCC (like avcC, hdlr, data) is not always a unique identity.",
                "  The same box type (hdlr) can exist in different places with different meaning.",
                "  Guessing caused bugs and ambiguity.",
                "",
                "What to do instead:",
                "",
                "OPTION 1: You KNOW what this leaf box is (most common)",
                "Get the extractor directly from the registry and pass the bytes in.",
                "",
                "Example:",
                "  const extractor = GoldenTruthRegistry.getExtractor(",
                "      \"moov/trak/mdia/minf/stbl/stsd|avc1/avcC\"",
                "  );",
                "  const fields = extractor.readBoxReport(boxBytes);",
                "  const params = extractor.getEmitterInput(boxBytes);",
                "",
                "OPTION 2: You do NOT know what this leaf box is",
                "Keep structural context earlier and resolve identity BEFORE extracting bytes.",
                "",
                "Example:",
                "  // WRONG (loses context):",
                "  const leafBytes = someChild.raw;",
                "",
                "  // RIGHT (keep context):",
                "  getGoldenTruthBox.getSemanticBoxDataFromBox({",
                "      boxBytes: containerBytes,",
                "      sourceRegistryKey: \"moov/trak/mdia/minf/stbl\",",
                "      targetBoxPath: \"moov/trak/mdia/minf/stbl/stsd/sample[0]/avcC\"",
                "  });",
                "",
                "Rule:",
                "  - Known identity → use GoldenTruthRegistry.getExtractor(...)",
                "  - Unknown identity → do NOT drop to raw bytes",
            ].join("\n")
        );
        // ---------------------------------------------------------
        // 0. Basic validation
        // ---------------------------------------------------------
        if (!(boxBytes instanceof Uint8Array)) {
            throw new Error(
                "bindLeafBoxToExtractor: boxBytes must be a Uint8Array\n" +
                `Received: ${Object.prototype.toString.call(boxBytes)}`
            );
        }

        if (boxBytes.length < 8) {
            throw new Error(
                "bindLeafBoxToExtractor: box too small to be a valid ISO box"
            );
        }

        // ---------------------------------------------------------
        // 1. Read FourCC
        // ---------------------------------------------------------
        let fourcc;

        try {
            fourcc = readFourCC(boxBytes, 4);
        } catch {
            throw new Error(
                "bindLeafBoxToExtractor: unable to read box FourCC"
            );
        }

        // ---------------------------------------------------------
        // 2. Explicit extractor binding (caller owns disambiguation)
        // ---------------------------------------------------------
        if (explicitRegistryKey !== undefined) {

            if (typeof explicitRegistryKey !== "string") {
                throw new Error(
                    "bindLeafBoxToExtractor: explicitRegistryKey must be a string"
                );
            }

            const extractor =
                GoldenTruthRegistry.getExtractor(explicitRegistryKey);

            if (!extractor) {
                throw new Error(
                    `bindLeafBoxToExtractor: no extractor registered for '${explicitRegistryKey}'`
                );
            }

            return {
                readBoxReport() {
                    return extractor.readBoxReport(boxBytes);
                },

                getEmitterInput() {
                    return extractor.getEmitterInput(boxBytes);
                }
            };
        }

        // ---------------------------------------------------------
        // 3. Implicit resolution by FourCC (must be unambiguous)
        // ---------------------------------------------------------
        const candidates =
            GoldenTruthRegistry
            .__getRegistryKeys()
            .filter(key => {

                const tail =
                    key.includes("/")
                    ? key.slice(key.lastIndexOf("/") + 1)
                    : key;

                const terminal =
                    tail.includes("|")
                    ? tail.slice(tail.lastIndexOf("|") + 1)
                    : tail;

                return terminal === fourcc;
            });

        if (candidates.length === 0) {
            throw new Error(
                `bindLeafBoxToExtractor: no extractor registered for box type '${fourcc}'`
            );
        }

        if (candidates.length > 1) {
            throw new Error(
                [
                    `bindLeafBoxToExtractor: extractor for box type '${fourcc}' is ambiguous.`,
                    "",
                    "Possible registry keys:",
                    ...candidates.map(k => `- ${k}`),
                    "",
                    "Pass explicitRegistryKey to disambiguate."
                ].join("\n")
            );
        }

        // ---------------------------------------------------------
        // 4. Single unambiguous match
        // ---------------------------------------------------------
        const extractor =
            GoldenTruthRegistry.getExtractor(candidates[0]);

        return {
            readBoxReport() {
                return extractor.readBoxReport(boxBytes);
            },

            getEmitterInput() {
                return extractor.getEmitterInput(boxBytes);
            }
        };
    }
};

function validateGetSemanticBoxDataFromBoxArgs({ boxBytes, sourceRegistryKey, targetBoxPath }) {

    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error(
            "getSemanticBoxDataFromBox: boxBytes must be a Uint8Array\n" +
            `Received: ${Object.prototype.toString.call(boxBytes)}`
        );
    }

    if (typeof sourceRegistryKey !== "string" || sourceRegistryKey.length === 0) {
        throw new Error(
            "getSemanticBoxDataFromBox: sourceRegistryKey must be a non-empty string\n" +
            `Received: ${typeof sourceRegistryKey} (${String(sourceRegistryKey)})`
        );
    }

    if (typeof targetBoxPath !== "string" || targetBoxPath.length === 0) {
        throw new Error(
            "getSemanticBoxDataFromBox: targetBoxPath must be a non-empty string\n" +
            `Received: ${typeof targetBoxPath} (${String(targetBoxPath)})`
        );
    }

    const isAbsoluteMp4Path =
        targetBoxPath.startsWith("moov") ||
        targetBoxPath.startsWith("ftyp") ||
        targetBoxPath.startsWith("free") ||
        targetBoxPath.startsWith("mdat");

    if (!isAbsoluteMp4Path) {
        throw new Error(
            "Relative traversal is not supported.\n" +
            "Traversal paths must be absolute and start at an MP4 root box\n" +
            "(moov, ftyp, free, or mdat)."
        );
    }

    if (targetBoxPath.includes("|")) {
        throw new Error(
            [
                "Invalid path syntax.",
                "",
                "SampleEntries must be addressed using sample[n] selectors.",
                "",
                "The '|' character is internal and must not appear in input paths.",
                "",
                "Correct examples:",
                "  moov/trak[0]/mdia/minf/stbl/stsd/sample[0]",
                "  moov/trak[0]/mdia/minf/stbl/stsd/sample[0]/avcC"
            ].join("\n")
        );
    }
}

function normalizeTargetBoxPathAfterTrakResolution(targetBoxPath) {
    if (typeof targetBoxPath !== "string") {
        throw new Error("normalizeTargetBoxPathAfterTrakResolution: targetBoxPath must be a string");
    }

    const normalizedTargetBoxPath = targetBoxPath.replace(/^moov\/trak\[\d+\]/, "moov/trak");

    if (normalizedTargetBoxPath === targetBoxPath) {
        throw new Error(
            "normalizeTargetBoxPathAfterTrakResolution: expected trak[index] in path\n" +
            `targetBoxPath: ${targetBoxPath}`
        );
    }

    return normalizedTargetBoxPath;
}

function readUint32Be(bytes, offset) {
    return (
        ((bytes[offset] << 24) >>> 0) |
        (bytes[offset + 1] << 16) |
        (bytes[offset + 2] << 8) |
        bytes[offset + 3]
    ) >>> 0;
}

function readBoxSizeAtOffset(bytes, offset, containerEndOffset) {
    const declaredSize = readUint32Be(bytes, offset);

    if (declaredSize === 0) {
        const boxSize = containerEndOffset - offset;
        if (boxSize < 8) {
            throw new Error("readBoxSizeAtOffset: size=0 box too small");
        }
        return boxSize;
    }

    if (declaredSize === 1) {
        if (offset + 16 > containerEndOffset) {
            throw new Error("readBoxSizeAtOffset: size=1 missing 64-bit largesize");
        }

        const high = readUint32Be(bytes, offset + 8);
        const low = readUint32Be(bytes, offset + 12);
        const largeSize = high * 2 ** 32 + low;

        if (!Number.isFinite(largeSize) || largeSize < 16) {
            throw new Error("readBoxSizeAtOffset: invalid 64-bit largesize");
        }
        if (largeSize > Number.MAX_SAFE_INTEGER) {
            throw new Error("readBoxSizeAtOffset: largesize exceeds JS safe integer");
        }
        return largeSize;
    }

    if (declaredSize < 8) {
        throw new Error("readBoxSizeAtOffset: invalid 32-bit box size");
    }

    return declaredSize;
}

/**
 * resolveTopLevelMp4Box
 * ====================
 *
 * Structural utility.
 *
 * - Looks ONLY at top-level MP4 boxes
 * - Does NOT recurse
 * - Does NOT mutate bytes
 * - Does NOT enforce MP4 validity
 * - Does NOT throw on absence
 *
 * Returns a stable, explicit result shape.
 */
export function resolveTopLevelMp4Box(mp4Bytes, boxType) {

    if (!(mp4Bytes instanceof Uint8Array)) {
        throw new Error("resolveTopLevelMp4Box: mp4Bytes must be Uint8Array");
    }

    if (typeof boxType !== "string" || boxType.length !== 4) {
        throw new Error(
            "resolveTopLevelMp4Box: boxType must be a 4-character string"
        );
    }

    let offset = 0;

    while (offset + 8 <= mp4Bytes.length) {

        const size = readBoxSizeAtOffset(mp4Bytes, offset, mp4Bytes.length);
        if (offset + size > mp4Bytes.length) {
            throw new Error("resolveTopLevelMp4Box: box extends past file end");
        }

        const type =
            String.fromCharCode(
                mp4Bytes[offset + 4],
                mp4Bytes[offset + 5],
                mp4Bytes[offset + 6],
                mp4Bytes[offset + 7]
            );

        if (type === boxType) {
            return {
                exists: true,
                boxBytes: mp4Bytes.slice(offset, offset + size)
            };
        }

        offset += size;
    }

    return {
        exists: false,
        boxBytes: null
    };
}

function resolveTargetBoxIdentityFromStructure(traversalRequest, { stsdBytes }) {

    const { trackIndex, sampleIndex, remainingTraversalPath } = traversalRequest;

    // ---------------------------------------------------------
    // Guard: identity must not already be resolved
    // ---------------------------------------------------------
    if (traversalRequest.targetBoxIdentity.resolved) {
        return;
    }

    // ---------------------------------------------------------
    // Case 1: no track, no sample → identity is structural
    // Example: moov, ftyp, mdat
    // ---------------------------------------------------------
    if (trackIndex === null && sampleIndex === null) {

        traversalRequest.targetBoxIdentity.resolved = true;
        traversalRequest.targetBoxIdentity.key      = stripBracketSelectors(remainingTraversalPath);

        return;
    }

    // ---------------------------------------------------------
    // Case 2: track selected, but no sample
    // Example: moov/trak[0]/mdia/minf/stbl/stsd
    // ---------------------------------------------------------
    if (trackIndex !== null && sampleIndex === null) {

        traversalRequest.targetBoxIdentity.resolved = true;
        traversalRequest.targetBoxIdentity.key      = stripBracketSelectors(remainingTraversalPath);

        return;
    }

    // ---------------------------------------------------------
    // Case 3: sample entry selected (stsd/sample[n])
    // ---------------------------------------------------------
    if (sampleIndex !== null) {
        if (!stsdBytes) {
            throw new Error("resolveTargetBoxIdentityFromStructure: stsdBytes required to resolve sample entry");
        }

        // Enumerate sample entries structurally
        const sampleEntries = getSampleEntryTableFromStsdAsList(stsdBytes);

        if (sampleIndex < 0 || sampleIndex >= sampleEntries.length) {
            throw new Error(`sample[${sampleIndex}] out of range (found ${sampleEntries.length})`);
        }

        const entry = sampleEntries[sampleIndex];
        const codec = entry.type;

        // Does the path continue past the sample entry?
        const afterSample = remainingTraversalPath.replace(/^.*stsd\/sample\[\d+\]\/?/, "");

        // -----------------------------------------------------
        // Terminal sample entry
        // -----------------------------------------------------
        if (afterSample === "") {
            traversalRequest.targetBoxIdentity.resolved = true;
            traversalRequest.targetBoxIdentity.key      = `moov/trak/mdia/minf/stbl/stsd|${codec}`;
            return;
        }

        // -----------------------------------------------------
        // Sample entry child (e.g. avcC, esds)
        // -----------------------------------------------------
        traversalRequest.targetBoxIdentity.resolved = true;
        traversalRequest.targetBoxIdentity.key      = `moov/trak/mdia/minf/stbl/stsd|${codec}/${afterSample}`;
        return;
    }

    // ---------------------------------------------------------
    // Fallback (should be unreachable)
    // ---------------------------------------------------------
    throw new Error("resolveTargetBoxIdentityFromStructure: unable to resolve target identity");
}

function findOneOfAlternatives({ parentRegistryKey, missingChild }) {

    const schema = getBoxSchemaForPath(parentRegistryKey);
    if (!schema || !Array.isArray(schema.children)) {
        return null;
    }

    // Normalize child tokens (strip ?)
    const children = schema.children.map(c =>
        typeof c === "string" ? c.replace(/\?$/, "") : c
    );

    // If the missing child is not even declared, bail
    if (!children.includes(missingChild)) {
        return null;
    }

    // OneOf heuristic (for now):
    // siblings at same level, same structural role, mutually exclusive in spec
    //
    // For now we hard-detect known MP4 alternates.
    const ONE_OF_GROUPS = [
        ["stco", "co64"],
        ["vmhd", "smhd"],
    ];

    for (const group of ONE_OF_GROUPS) {
        if (group.includes(missingChild)) {
            return group.filter(x => x !== missingChild);
        }
    }

    return null;
}


// ---------------------------------------------------------
// Generic ISO container traversal
// ---------------------------------------------------------
// ---------------------------------------------------------------------
// TRANSITIONAL TRAVERSAL NOTE
// ---------------------------------------------------------------------
//
// This call to findTraversalNodesByPathFromBoxBytes() is
// intentionally retained for now.
//
// Long-term direction (Option B):
// --------------------------------
// Generic ISO traversal should be fully encapsulated inside
// GoldenTruthPathResolver, with this layer delegating resolution via
// resolveByPathToBoxAndContainingTrack() only.
//
// That refactor would:
//   - eliminate direct traversal from this facade
//   - make path resolution + traversal a single authority
//   - further separate orchestration from structural mechanics
//
// Why this remains today:
// -----------------------
// - This file is already mid-refactor
// - Rewriting traversal here would be a semantic change, not a cleanup
// - We are deliberately stabilizing one layer at a time
//
// This call is therefore:
//   - internal
//   - transitional
//   - non-authoritative
//
// Do not copy this pattern elsewhere.
// ---------------------------------------------------------------------
function resolveSingleIsoBoxFromContainer({
    sourceBoxBytes,
    remainingTraversalPath,
    sourceRegistryKey,
    targetBoxPath
}) {

    if (!sourceRegistryKey) {
        throw new Error(
            "resolveSingleIsoBoxFromContainer: sourceRegistryKey is required"
        );
    }
    // ---------------------------------------------------------
    // Normalize traversal to be relative to the provided box
    // ---------------------------------------------------------
    let relativeTraversalPath = remainingTraversalPath;

    if (
        sourceRegistryKey === "moov" &&
        relativeTraversalPath.startsWith("moov/")
    ) {
        relativeTraversalPath =
            relativeTraversalPath.slice("moov/".length);
    }
    else if (
        relativeTraversalPath.startsWith(sourceRegistryKey + "/")
    ) {
        relativeTraversalPath =
            relativeTraversalPath.slice(
                sourceRegistryKey.length + 1
            );
    }

    let boxes;

    boxes = findTraversalNodesByPathFromBoxBytes({
        boxBytes: sourceBoxBytes,
        path: relativeTraversalPath,
        baseRegistryPath: sourceRegistryKey
    });

    if (boxes.length === 0) {

        function getTerminalBoxName(path) {
            if (typeof path !== "string" || path.length === 0) {
                return "<unknown>";
            }

            const parts = path.split("/");
            return parts[parts.length - 1];
        }

        const boxName = getTerminalBoxName(relativeTraversalPath);

        // 1. Optional child → not found, not an error
        const parentRegistryKey =
            stripBracketSelectors(
                stripTrailingSlash(
                    remainingTraversalPath.slice(
                        0,
                        remainingTraversalPath.lastIndexOf("/")
                    )
                )
            );

        if (isOptionalChild({
            parentRegistryKey,
            child: boxName
        })) {
            return { found: false };
        }

        // 2. oneOf alternative → unsupported
        const alternatives = findOneOfAlternatives({
            parentRegistryKey: sourceRegistryKey,
            missingChild: boxName
        });

        if (alternatives) {
            throw new Error(
                [
                    `Box '${boxName}' not found under '${sourceRegistryKey}'.`,
                    `An alternative box is permitted here: ${alternatives.join(", ")}.`,
                    `This alternative is not yet supported.`
                ].join("\n")
            );
        }

        // 3. Required child → error
        throw new IsoBoxNotFoundError(
            `Box '${boxName}' not found under '${sourceRegistryKey}'`
        );
    }

    if (boxes.length > 1) {
        const receivedPaths =
            boxes.map(b => b.__registryPath ?? "<unregistered>").join(", ");

        throw new Error(
            `resolveSingleIsoBoxFromContainer: expected exactly one box at '${targetBoxPath}', ` +
            `but received ${boxes.length}: [${receivedPaths}]`
        );
    }

    return boxes[0].boxBytes;
}

function normalizeRegistryAndTraversalPath({
    sourceRegistryKey,
    targetBoxPath
}) {

    let remainingTraversalPath;

    // We only accept FULL, ABSOLUTE paths here.
    //
    // This function does NOT try to be clever.
    // It does NOT figure out what box you mean.
    // It does NOT rewrite anything.
    //
    // All it does is check:
    // "Does this path clearly start from the box we were given?"
    //
    // sourceRegistryKey tells us what the bytes represent.
    // Example:
    //   sourceRegistryKey === "moov"
    //
    // So valid paths are:
    //   "moov"                 → you are already at the target
    //   "moov/..."             → you want to go deeper inside it
    //
    // Anything else would mean:
    //   - a relative path
    //   - or trying to jump somewhere else
    //
    // We don't allow that. It causes confusion and bugs.
    //
    if ( targetBoxPath === sourceRegistryKey || targetBoxPath.startsWith(sourceRegistryKey + "/")) {
        // Keep the path exactly as-is.
        // Later code will walk this path step by step.
        remainingTraversalPath = targetBoxPath;
    }
    else {
        // If the path doesn't clearly start from the given box,
        // we stop immediately instead of guessing.
        throw new Error(
            "normalizeRegistryAndTraversalPath: relative paths are not supported"
        );
    }

    // eg ../sample[1]/avc1 becomes ../sample/avc1
    const targetBoxRegistryKey = stripBracketSelectors(targetBoxPath);

    return {
        sourceRegistryKey,
        remainingTraversalPath,
        targetBoxRegistryKey
    };
}

function lookupExtractorByRegistryKey(registryKey) {

    const extractor = GoldenTruthRegistry.getExtractor(registryKey);

    if (!extractor) {
        throw new Error(
            `No extractor registered for ${registryKey}`
        );
    }

    return extractor;
}


function resolveIsoBoxAndCreateSemanticBoxData(traversalRequest, extractor) {

    const sourceBoxBytes = resolveSingleIsoBoxFromContainer(traversalRequest);

    // OPTIONAL BOX ABSENCE — short-circuit
    if (sourceBoxBytes && sourceBoxBytes.found === false) {
        return { found: false };
    }

    if (!(sourceBoxBytes instanceof Uint8Array)) {
        throw new Error(
            "resolveIsoBoxAndCreateSemanticBoxData: expected Uint8Array\n" +
            `Received: ${Object.prototype.toString.call(sourceBoxBytes)}`
        );
    }

    return {
        readBoxReport() {
            return extractor.readBoxReport(sourceBoxBytes);
        },

        getEmitterInput() {
            return extractor.getEmitterInput(
                sourceBoxBytes,
                traversalRequest.options
            );
        }
    };
}

function resolveSampleEntryBoundaryFromTraversalRequest({traversalRequest, stsdBytes}) {

    const extractedBoxBytes = materializeSampleEntryBytesFromTraversalRequest({traversalRequest, stsdBytes});
    const extractor = lookupExtractorByRegistryKey(traversalRequest.targetBoxIdentity.key);

    return {
        readBoxReport() {
            return extractor.readBoxReport(extractedBoxBytes);
        },

        getEmitterInput() {
            return extractor.getEmitterInput(extractedBoxBytes);
        }
    };
}

function registryKeyCrossesSampleEntryBoundary(registryKey) {
    return (
        registryKey.includes("|") ||
        registryKey.includes("/sample")
    );
}

function resolveTrakBytesFromTraversalRequest(traversalRequest) {

    if (!(traversalRequest.sourceBoxBytes instanceof Uint8Array)) {
        throw new Error(
            "resolveTrakBytesFromTraversalRequest: traversalRequest.sourceBoxBytes must be Uint8Array"
        );
    }

    if (traversalRequest.trackIndex === null) {
        throw new Error(
            "resolveTrakBytesFromTraversalRequest: traversalRequest.trackIndex is required"
        );
    }

    return resolveTrakFromMoov(
        traversalRequest.sourceBoxBytes,
        traversalRequest.trackIndex
    );
}

/**
 * resolveTrakFromMoov
 * ===================
 *
 * Structural selector.
 *
 * - Queries moov for trak[n]
 * - NEVER throws for absence
 * - Throws ONLY for malformed containers
 *
 * Return:
 * - { found: true, bytes }
 * - { found: false }
 */
function resolveTrakFromMoov(moovBytes, trackIndex) {

    if (!(moovBytes instanceof Uint8Array)) {
        throw new Error("resolveTrakFromMoov: moovBytes must be Uint8Array");
    }

    if (!Number.isInteger(trackIndex) || trackIndex < 0) {
        throw new Error("resolveTrakFromMoov: trackIndex must be >= 0");
    }

    let offset = 8;
    let found = 0;

    while (offset + 8 <= moovBytes.length) {

        const size = readBoxSizeAtOffset(moovBytes, offset, moovBytes.length);
        if (offset + size > moovBytes.length) {
            throw new Error("resolveTrakFromMoov: box extends past moov end");
        }

        const type =
            String.fromCharCode(
                moovBytes[offset + 4],
                moovBytes[offset + 5],
                moovBytes[offset + 6],
                moovBytes[offset + 7]
            );

        if (type === "trak") {
            if (found === trackIndex) {
                return {
                    found: true,
                    bytes: moovBytes.slice(offset, offset + size)
                };
            }
            found++;
        }

        offset += size;
    }

    return { found: false };
}

function materializeSampleEntryBytesFromTraversalRequest({ traversalRequest, stsdBytes }) {
    // Preconditions:
    // - traversalRequest.sampleIndex !== null
    // - stsdBytes is raw Uint8Array (stsd box bytes)

    const { sampleIndex, remainingTraversalPath } = traversalRequest;

    const sampleEntries = getSampleEntryTableFromStsdAsList(stsdBytes);

    if (sampleIndex < 0 || sampleIndex >= sampleEntries.length) {
        throw new Error(
            `sample[${sampleIndex}] out of range (found ${sampleEntries.length})`
        );
    }

    const entry = sampleEntries[sampleIndex];

    // ---------------------------------------------------------
    // 1. Materialize the SampleEntry bytes
    // ---------------------------------------------------------
    const sampleEntryBytes =
        stsdBytes.slice(
            entry.offset,
            entry.offset + entry.size
        );

    // Does the path stop at the sample entry?
    const afterSample =
        remainingTraversalPath.replace(/^.*stsd\/sample\[\d+\]\/?/, "");

    if (afterSample === "") {
        // Terminal sample entry (avc1, mp4a, Opus, etc.)
        return sampleEntryBytes;
    }

    // ---------------------------------------------------------
    // 2. Materialize child box inside SampleEntry
    //    (Schema-driven via SampleEntryReader)
    // ---------------------------------------------------------
    const codec = entry.type;
    const childFourCC = afterSample;

    let childBoxBytes;

    try {
        const reader = new SampleEntryReader(sampleEntryBytes, codec);
        childBoxBytes = reader.getChild(childFourCC);
    } catch {
        childBoxBytes = null;
    }

    if (!childBoxBytes) {
        throw new Error(
            [
                "Invalid SampleEntry child for selected track.",
                "",
                `Selected SampleEntry codec: ${codec}`,
                `Requested child box: ${childFourCC}`,
                "",
                "Why this failed:",
                "  The requested child does not exist in this track's sample entry.",
                "  Track selection via trak[n] is authoritative.",
                "",
                "This usually means:",
                "  - you selected the audio track but requested a video-only box, or",
                "  - you selected the video track but requested an audio-only box.",
            ].join("\n")
        );
    }

    return childBoxBytes;
}

function isOptionalChild({ parentRegistryKey, child }) {
    const schema = getBoxSchemaForPath(parentRegistryKey);
    if (!schema || !Array.isArray(schema.children)) {
        return false;
    }

    const optional = schema.children.some(childBox =>
        typeof childBox === "string" &&
        childBox.endsWith("?") &&
        childBox.replace(/\?$/, "") === child
    );

    return optional;
}

function runSemanticValidators(traversalRequest) {
    const resolvedKey = traversalRequest.targetBoxIdentity.key;
    if (!resolvedKey) return;

    const lastSlash = resolvedKey.lastIndexOf("/");
    if (lastSlash === -1) return;

    const parentKey = resolvedKey.slice(0, lastSlash);
    const childBox  = resolvedKey.slice(lastSlash + 1);

    const validator = SEMANTIC_VALIDATORS[parentKey];
    if (!validator) return;

    // 🚨 CRITICAL GUARD:
    // Only validate DIRECT children, never containers or grandchildren
    if (childBox.includes("/")) return;

    // For minf, only headers are semantically meaningful
    if (parentKey === "moov/trak/mdia/minf") {
        if (childBox !== "vmhd" && childBox !== "smhd") {
            return;
        }
    }

    const trakBytes = traversalRequest.trakBytes;
    if (!trakBytes) return;

    const hdlr = getGoldenTruthBox
        .getSemanticBoxDataFromBox({
            boxBytes: trakBytes,
            sourceRegistryKey: "moov/trak",
            targetBoxPath: "moov/trak/mdia/hdlr"
        })
        .readBoxReport();

    const trackHandlerType = hdlr.box.fields.handlerType;

    validator({
        trackHandlerType,
        resolvedChildBoxType: childBox,
        traversalRequest
    });
}

function validateMinfByHandlerType({
    trackHandlerType,
    resolvedChildBoxType
}) {
    if (trackHandlerType === "vide" && resolvedChildBoxType === "smhd") {
        throw new Error("Video track must not contain smhd");
    }

    if (trackHandlerType === "soun" && resolvedChildBoxType === "vmhd") {
        throw new Error("Audio track must not contain vmhd");
    }

    // subtitles later:
    // if (handlerType === "subt" && resolvedChildBoxType !== "nmhd") …
}

export const __TEST_ONLY__ = Object.freeze({
    normalizeRegistryAndTraversalPath,
    resolveSingleIsoBoxFromContainer,
    lookupExtractorByRegistryKey,
    resolveSampleEntryBoundaryFromTraversalRequest,
});
