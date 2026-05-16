/**
 * STSD — Sample Description Box
 * =============================
 *
 * Golden truth extractor for the STSD (Sample Description) box.
 *
 * ---------------------------------------------------------------------------
 * Why STSD is architecturally different
 * ---------------------------------------------------------------------------
 *
 * In the ISO Base Media File Format, most structures are ISO boxes:
 *
 *   [ size ][ type ][ payload ... ]
 *
 * These boxes form a recursive container hierarchy and can be traversed
 * generically using ISO container rules.
 *
 * STSD is not such a container.
 *
 * While STSD itself is an ISO box, its children — SampleEntries — are NOT.
 *
 * A SampleEntry:
 *   - describes how samples in a track are encoded
 *   - is defined by codec specifications, not ISO
 *   - has a codec-defined header size
 *   - may contain child boxes that begin after that header
 *
 * Because of this, SampleEntries:
 *   - cannot be traversed using generic ISO container logic
 *   - require STSD-specific structural parsing
 *
 * This extractor makes that distinction explicit.
 *
 * ---------------------------------------------------------------------------
 * What this extractor is responsible for
 * ---------------------------------------------------------------------------
 *
 * This extractor is invoked ONLY when the resolved path endpoint is `stsd`.
 *
 * In that context:
 *   - the requested object is the STSD box itself
 *   - all SampleEntries contained in the STSD are in scope
 *   - there is no positional or selective intent
 *
 * Responsibilities:
 *
 *   1. Parse the STSD box header
 *      - version / flags
 *      - entry_count
 *
 *   2. Enumerate ALL SampleEntries structurally from STSD bytes
 *      - using STSD-aware parsing logic
 *      - NOT using selector grammar (sample[n])
 *
 *   3. For each SampleEntry:
 *      - obtain its raw bytes
 *      - identify its FourCC (avc1, mp4a, etc.)
 *      - delegate to the appropriate SampleEntry extractor
 *      - receive emitter-ready SampleEntry nodes
 *
 *   4. Assemble and return emitter input for the STSD emitter
 *      - including all built SampleEntry nodes
 *      - preserving original ordering
 *
 * This extractor produces a complete, emitter-ready representation
 * of the STSD box as it exists in the source file.
 *
 * ---------------------------------------------------------------------------
 * What this extractor deliberately does NOT do
 * ---------------------------------------------------------------------------
 *
 * This extractor does NOT:
 *
 *   - interpret selector grammar (e.g. sample[n])
 *   - choose or filter SampleEntries
 *   - infer codec semantics
 *   - special-case "single entry" layouts
 *   - re-enter the path resolver
 *
 * Positional selection of SampleEntries (sample[n]) is a path-resolution
 * concern and is handled elsewhere.
 *
 * This extractor operates only on resolved STSD box bytes and their
 * intrinsic contents.
 *
 * ---------------------------------------------------------------------------
 * Architectural rationale
 * ---------------------------------------------------------------------------
 *
 * Earlier designs split STSD extraction by codec (stsd/avc1, stsd/mp4a)
 * and relied on selector grammar inside extractors.
 *
 * That approach was rejected because it:
 *   - mixed path resolution with extraction
 *   - duplicated resolver semantics
 *   - hard-coded assumptions about entry count
 *
 * The current design restores a clean separation:
 *
 *   - Path resolution determines *what* is being extracted
 *   - This extractor determines *what it means*
 *
 * By enumerating SampleEntries structurally rather than selecting them
 * grammatically, STSD extraction becomes:
 *   - deterministic
 *   - codec-agnostic
 *   - aligned with existing container extractors (trak, minf)
 *
 * ---------------------------------------------------------------------------
 * Summary
 * ---------------------------------------------------------------------------
 *
 * STSD is an ISO box that contains non-ISO structures.
 *
 * This extractor:
 *   - acknowledges that irregularity explicitly
 *   - parses SampleEntries structurally
 *   - delegates meaning to SampleEntry extractors
 *   - returns complete emitter input for STSD
 *
 * No selector grammar.
 * No policy.
 * No ambiguity.
 */

import { readUint32 } from "../../bytes/mp4ByteReader.js";
import { readFourCC } from "../../box-schema/boxLayoutReaders.js";
import { getGoldenTruthBox } from "./index.js";
import {
    getSampleEntryTableFromStsdAsList
} from "../../reference/getSampleEntryTableFromStsdAsList.js";
import { EmitterRegistry } from "../../box-emitters/EmitterRegistry.js";
import { GoldenTruthRegistry } from "./GoldenTruthRegistry.js"

/**
 * STSD — Sample Description Box
 * =============================
 *
 * Golden truth extractor for the STSD (Sample Description) box.
 *
 * See file-level documentation for architectural rationale.
 */
function readStsdFieldsFromBoxBytes(boxBytes) {
    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error("stsd.readBoxReport: expected Uint8Array");
    }

    if (readFourCC(boxBytes, 4) !== "stsd") {
        throw new Error(
            "stsd.readBoxReport: expected full STSD box bytes"
        );
    }

    const entries = getSampleEntryTableFromStsdAsList(boxBytes);

    const children = {};
    for (const entry of entries) {
        if (!children[entry.type]) {
            children[entry.type] = [];
        }
        children[entry.type].push({});
    }

    return {
        raw: boxBytes,

        box: {
            type: "stsd",

            header: {
                version: boxBytes[8],
                flags:
                    (boxBytes[9]  << 16) |
                    (boxBytes[10] << 8)  |
                     boxBytes[11]
            },

            fields: {
                sampleEntryCount: readUint32(boxBytes, 12)
            },

            children
        },

        derived: {}
    };
}

function getStsdEmitterInputFromBoxBytes(boxBytes) {

    // ---------------------------------------------------------
    // Read structural fields
    // ---------------------------------------------------------
    const fields = readStsdFieldsFromBoxBytes(boxBytes);
    const sampleEntryCount = fields.box.fields.sampleEntryCount;

    // ---------------------------------------------------------
    // Enumerate SampleEntries structurally
    // ---------------------------------------------------------
    const sampleEntries =
        getSampleEntryTableFromStsdAsList(boxBytes);

    if (sampleEntries.length !== sampleEntryCount) {
        throw new Error(
            `stsd.getEmitterInput: sampleEntryCount mismatch ` +
            `(header=${sampleEntryCount}, parsed=${sampleEntries.length})`
        );
    }

    // ---------------------------------------------------------
    // Build SampleEntry boxes
    // ---------------------------------------------------------
    const builtSampleEntries = sampleEntries.map(entry => {

        const sampleEntryBytes =
            boxBytes.slice(entry.offset, entry.offset + entry.size);

        const sampleType = readFourCC(sampleEntryBytes, 4);

        const registryKey =
            `moov/trak/mdia/minf/stbl/stsd|${sampleType}`;

        const extractor =
            GoldenTruthRegistry.getExtractor(registryKey);

        if (!extractor) {
            throw new Error(
                `stsd.getEmitterInput: no extractor registered for ${registryKey}`
            );
        }

        const params =
            extractor.getEmitterInput(sampleEntryBytes);

        return EmitterRegistry.assemble(
            registryKey,
            params
        );
    });

    // ---------------------------------------------------------
    // Emitter input
    // ---------------------------------------------------------
    return {
        sampleEntries: builtSampleEntries
    };
}

export function registerStsdGoldenTruthExtractor(register) {
    register.readBoxReport(readStsdFieldsFromBoxBytes);
    register.getEmitterInput(getStsdEmitterInputFromBoxBytes);
}
