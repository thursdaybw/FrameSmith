import {
    asIsoBoxContainer,
} from "../../box-model/Box.js";

import {
    getBoxSchemaForPath
} from "../../box-schema/boxSchemas.js";

/**
 * Golden Truth Extractor Registry
 * ===============================
 *
 * This module defines and ENFORCES the contract for all Golden Truth extractors.
 *
 * Extractors are test-only components whose job is to:
 *   - read MP4 box bytes
 *   - expose factual, observable information
 *   - without applying policy or making decisions
 *
 * This registry is the *single enforcement point* for extractor behaviour.
 *
 * ---------------------------------------------------------------------------
 * The Two Extractor Methods
 * ---------------------------------------------------------------------------
 *
 * Every extractor MUST implement exactly two methods:
 *
 *   1. readBoxReport(boxBytes)
 *   2. getEmitterInput(boxBytes)
 *
 * They serve different purposes and must not overlap.
 *
 * ---------------------------------------------------------------------------
 * readBoxReport(boxBytes)
 * ---------------------------------------------------------------------------
 *
 * Purpose:
 * --------
 * readBoxReport exists to READ FACTS from an MP4 box.
 *
 * It answers the question:
 *   "What is actually in this box?"
 *
 * It is used for:
 *   - inspection
 *   - conformance testing
 *   - locked-layout equivalence tests
 *   - future demux-style data access
 *
 * It MUST NOT:
 *   - infer intent
 *   - apply policy
 *   - guess defaults
 *   - rewrite values
 *   - mutate input bytes
 *
 * ---------------------------------------------------------------------------
 * Required return shape of readBoxReport()
 * ---------------------------------------------------------------------------
 *
 * readBoxReport() MUST return an object with EXACTLY these top-level keys:
 *
 * {
 *   raw: Uint8Array,
 *   box: { ... },
 *   derived: { ... }
 * }
 *
 * Any additional keys are rejected.
 *
 * ---------------------------------------------------------------------------
 * raw
 * ---------------------------------------------------------------------------
 *
 * raw is the original, untouched Uint8Array for the box.
 *
 * Rules:
 *   - MUST be the same bytes that were passed in
 *   - MUST NOT be copied or mutated
 *
 * Rationale:
 *   raw exists so byte-for-byte equivalence can always be asserted.
 *   Loss of raw bytes at this layer is irreversible.
 *
 * ---------------------------------------------------------------------------
 * box
 * ---------------------------------------------------------------------------
 *
 * box contains ONLY fields that come directly from the box itself.
 *
 * Allowed keys inside `box`:
 *   - type     (string)
 *   - header   (object, optional)
 *   - fields   (object)
 *   - children (object, containers only)
 *
 * Any other keys are rejected.
 *
 * ---------------------------------------------------------------------------
 * Header rules (schema-owned)
 * ---------------------------------------------------------------------------
 *
 * Header fields (version, flags) are governed EXCLUSIVELY by schema.
 *
 * Rules:
 *   - If schema.headerLayout === "Full":
 *       - box.header MUST be present
 *       - box.header.version MUST be a number
 *       - box.header.flags MUST be a number
 *
 *   - If schema.headerLayout === "Basic":
 *       - box.header MUST NOT be present
 *
 * Extractors MUST NOT:
 *   - hardcode header offsets
 *   - assume version/flags positions
 *   - infer header presence from box type
 *
 * All header layout knowledge belongs to the schema layer.
 *
 * ---------------------------------------------------------------------------
 * fields
 * ---------------------------------------------------------------------------
 *
 * box.fields contains literal, declared fields of the box.
 *
 * Rules:
 *   - Fields MUST exactly match schema.fields
 *   - No declared field may be missing
 *   - No undeclared field may be present
 *
 * Values must be:
 *   - directly observable from this box
 *   - read without interpretation
 *
 * Think:
 *   "What does this box literally encode?"
 *
 * ---------------------------------------------------------------------------
 * children
 * ---------------------------------------------------------------------------
 *
 * children is present ONLY for container boxes.
 *
 * Rules:
 *   - If schema.structuralRole === "container":
 *       - box.children MUST be present
 *   - If schema.structuralRole === "terminal":
 *       - box.children MUST NOT be present
 *
 * children represents the immediate MP4 box tree only.
 *
 * ---------------------------------------------------------------------------
 * Structural Integrity Rule (Demuxer Invariant)
 * ---------------------------------------------------------------------------
 *
 * readBoxReport().box MUST be a lossless structural representation of the MP4
 * box byte tree.
 *
 * This means:
 *   - Child boxes MUST be represented as child boxes
 *   - Ordering MUST be preserved
 *   - No child box data may be flattened or promoted
 *   - No semantic interpretation is permitted in `box`
 *
 * Convenience access, semantic views, and computed representations
 * MUST live in `derived`.
 *
 * Rationale:
 *   This extraction layer is evolving into a demuxer.
 *   Structural loss at this level is irreversible and forbidden.
 *
 * ---------------------------------------------------------------------------
 * derived
 * ---------------------------------------------------------------------------
 *
 * derived contains values that are COMPUTED from MP4 data,
 * but are still factual and deterministic.
 *
 * Examples:
 *   - expanded sample tables
 *   - decoded timing arrays
 *   - access unit lists
 *
 * Rules:
 *   - Must be reproducible from MP4 data alone
 *   - Must not encode preference or policy
 *   - Must not assume how data will be used
 *
 * Think:
 *   "What can be calculated with certainty from the bytes?"
 *
 * ---------------------------------------------------------------------------
 * getEmitterInput(boxBytes)
 * ---------------------------------------------------------------------------
 *
 * Purpose:
 * --------
 * getEmitterInput answers a DIFFERENT question:
 *
 *   "What information is required to REBUILD this box?"
 *
 * It expresses semantic intent for the MP4 compiler.
 *
 * It MAY:
 *   - normalise values
 *   - restructure data
 *   - discard irrelevant inspection details
 *
 * It MUST NOT:
 *   - expose raw bytes
 *   - leak inspection-only structures
 *   - depend on registry enforcement
 *
 * ---------------------------------------------------------------------------
 * Enforcement
 * ---------------------------------------------------------------------------
 *
 * This registry enforces all of the above at runtime.
 *
 * Violations FAIL FAST.
 *
 * This is intentional.
 *
 * The goal is not flexibility.
 * The goal is architectural honesty and long-term correctness.
 */
function assertReadFieldsShape(result, path) {
    const actualType =
        result === null ? "null" :
        Array.isArray(result) ? "array" :
        typeof result;

    if (!result || typeof result !== "object") {
        throw new Error(
            `GoldenTruthRegistry: Contract for readBoxReport() at '${path}' requires an object, ` +
            `but the extractor gave ${actualType} instead.`
        );
    }

    const allowedKeys = ["raw", "box", "derived"];
    const actualKeys = Object.keys(result);

    for (const key of actualKeys) {
        if (!allowedKeys.includes(key)) {
            throw new Error(
                `GoldenTruthRegistry: readBoxReport() for '${path}' returned illegal key '${key}'.\n` +
                `Contract allows only { raw, box, derived }.`
            );
        }
    }

    const rawType =
        result.raw === undefined ? "missing" :
        result.raw instanceof Uint8Array ? "Uint8Array" :
        typeof result.raw;

    if (!(result.raw instanceof Uint8Array)) {
        throw new Error(
            `GoldenTruthRegistry: Contract for readBoxReport() at '${path}' requires { raw: Uint8Array }, ` +
            `but the extractor gave raw as ${rawType} instead.`
        );
    }

    const boxType =
        result.box === undefined ? "missing" :
        Array.isArray(result.box) ? "array" :
        typeof result.box;

    if (!result.box || typeof result.box !== "object") {
        throw new Error(
            `GoldenTruthRegistry: Contract for readBoxReport() at '${path}' requires { box: {...} }, ` +
            `but the extractor gave box as ${boxType} instead.`
        );
    }

    const derivedType =
        result.derived === undefined ? "missing" :
        Array.isArray(result.derived) ? "array" :
        typeof result.derived;

    if (!result.derived || typeof result.derived !== "object") {
        throw new Error(
            `GoldenTruthRegistry: Contract for readBoxReport() at '${path}' requires { derived: {...} }, ` +
            `but the extractor gave derived as ${derivedType} instead.`
        );
    }
}

function assertBoxReportShape(box, path) {
    const allowed = ["type", "header", "fields", "children"];

    for (const key of Object.keys(box)) {
        if (!allowed.includes(key)) {
            throw new Error(
                `GoldenTruthRegistry: Schema for '${path}' defines the structure of readBoxReport().box, ` +
                `but the extractor included illegal key '${key}'.\n` +
                `Allowed keys are { ${allowed.join(", ")} }.`
            );
        }
    }
}

function assertBoxChildrenMatchBytes(boxBytes, reportedBoxStructure, path) {

    const schema = getBoxSchemaForPath(path);

    if (schema.structuralRole !== "container") {
        return;
    }

    const container = asIsoBoxContainer(boxBytes, path);

    const actualChildren =
        Object.keys(container.children || {});

    if (actualChildren.length === 0) {
        return;
    }

    if (!reportedBoxStructure.children) {
        throw new Error(
            `GoldenTruthRegistry: Schema defines '${path}' as a container, ` +
            `but readBoxReport().box.children was missing.\n` +
            `(expected child boxes to be reported)`
        );
    }

    const reportedChildren =
        Object.keys(reportedBoxStructure.children);

    for (const type of actualChildren) {
        if (!reportedChildren.includes(type)) {
            throw new Error(
                `GoldenTruthRegistry: Schema and bytes indicate child '${type}' exists in '${path}', ` +
                `but readBoxReport().box.children did not report it.\n` +
                `(expected '${type}' to be present)`
            );
        }
    }
}

export const GoldenTruthRegistry = {

    extractors: {},

    registerExtractor(path, installer) {
        if (this.extractors[path]) {
            throw new Error(
                `GoldenTruthRegistry: An extractor is already registered for '${path}'.`
            );
        }

        const impl = {};

        installer({
            readBoxReport(fn) {
                impl.readBoxReport = function (boxBytes, ...args) {
                    const result = fn(boxBytes, ...args);

                    // ---------------------------------------------
                    // Shape enforcement (absolute minimum contract)
                    // ---------------------------------------------
                    assertReadFieldsShape(result, path);
                    assertBoxReportShape(result.box, path);

                    // ---------------------------------------------
                    // Schema enforcement (lossless truth)
                    // ---------------------------------------------
                    const schema = getBoxSchemaForPath(path);

                    assertBoxHeaderRules(result.box, schema, path);
                    assertBoxFieldsMatchSchema(result.box, schema, path);
                    assertBoxContainerRules(result.box, schema, path);

                    // ---------------------------------------------
                    // Structural byte-level integrity
                    // ---------------------------------------------
                    assertBoxChildrenMatchBytes(
                        result.raw,
                        result.box,
                        path
                    );

                    return result;
                };
            },

            getEmitterInput(fn) {
                impl.getEmitterInput = fn;
            }
        });

        if (!impl.readBoxReport || !impl.getEmitterInput) {
            throw new Error(
                `GoldenTruthRegistry: Extractor for '${path}' is incomplete.\n` +
                `(both readBoxReport() and getEmitterInput() are required)`
            );
        }

        this.extractors[path] = impl;
    },
    getExtractor(path) {
        return this.extractors[path] || null;
    },

    __getRegistryPaths() {
        return Object.keys(this.extractors);
    }
};

function assertBoxContainerRules(box, schema, path) {

    const isContainer =
        schema.structuralRole === "container";

    if (!isContainer && box.children) {
        throw new Error(
            `GoldenTruthRegistry: Schema defines '${path}' as a terminal box, ` +
            `but readBoxReport().box.children was provided.\n` +
            `(children are not allowed here)`
        );
    }

    if (isContainer && !box.children) {
        throw new Error(
            `GoldenTruthRegistry: Schema defines '${path}' as a container, ` +
            `but readBoxReport().box.children was missing.\n` +
            `(expected child boxes to be reported)`
        );
    }
}

function assertBoxFieldsMatchSchema(box, schema, path) {
    const declaredFields =
        schema.fields
            ? Object.keys(schema.fields)
            : [];

    const actualFields =
        box.fields
            ? Object.keys(box.fields)
            : [];

    for (const field of declaredFields) {
        if (!actualFields.includes(field)) {
            throw new Error(
                `GoldenTruthRegistry: Schema defines field '${field}' in '${path}', ` +
                `but readBoxReport().box.fields did not provide it.\n` +
                `(expected this field to be present)`
            );
        }
    }

    for (const field of actualFields) {
        if (!declaredFields.includes(field)) {
            throw new Error(
                `GoldenTruthRegistry: Schema does not define field '${field}' in '${path}', ` +
                `but readBoxReport().box.fields included it.\n` +
                `(this field is not allowed by the schema)`
            );
        }
    }
}

function assertBoxHeaderRules(box, schema, path) {

    const expectsFullHeader =
        schema.headerLayout === "Full";

    if (expectsFullHeader) {
        if (!box.header) {
            throw new Error(
                `GoldenTruthRegistry: Schema defines '${path}' as a FullBox, ` +
                `but readBoxReport().box.header was missing.`
            );
        }

        const versionType =
            typeof box.header?.version;

        if (typeof box.header.version !== "number") {
            throw new Error(
                `GoldenTruthRegistry: Schema defines '${path}' as a FullBox requiring 'version', ` +
                `but the extractor gave ${versionType} instead.`
            );
        }

        const flagsType =
            typeof box.header?.flags;

        if (typeof box.header.flags !== "number") {
            throw new Error(
                `GoldenTruthRegistry: Schema defines '${path}' as a FullBox requiring 'flags', ` +
                `but the extractor gave ${flagsType} instead.`
            );
        }
    } else {
        if (box.header !== undefined) {
            throw new Error(
                `GoldenTruthRegistry: Schema defines '${path}' as a BasicHeader box, ` +
                `but readBoxReport().box.header was provided.\n` +
                `(no header is allowed for this box type)`
            );
        }
    }
}

export function __getRegistryPaths() {
    return GoldenTruthRegistry.__getRegistryPaths();
}

