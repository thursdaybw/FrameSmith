/**
 * normalizeEmitterNodeToSchemaBox
 * ===============================
 *
 * PURPOSE
 * -------
 * This function exists solely to enable STRUCTURAL COMPARISON between:
 *
 *   - emitter output (proven against an ffmpeg oracle), and
 *   - readBoxReport().box output (candidate truth extractor)
 *
 * It performs a PURE NORMALIZATION.
 *
 * It is NOT:
 *   - an adapter
 *   - a fixer
 *   - a compensator
 *   - a semantic interpreter
 *   - a schema gap filler
 *
 * ---------------------------------------------------------------------
 * AUTHORITY MODEL (CRITICAL)
 * ---------------------------------------------------------------------
 *
 * During reconciliation:
 *
 *   1. Oracle MP4 (ffmpeg) is ground truth
 *   2. Emitters are a proven proxy for the oracle
 *   3. Schema and readBoxReport are brought into alignment with emitters
 *
 * Therefore:
 *
 *   - If normalized emitter output and readBoxReport().box disagree,
 *     the schema or extractor is WRONG.
 *
 *   - This function MUST NOT attempt to "fix" that disagreement.
 *
 * Its job is to REVEAL mismatches, not hide them.
 *
 * ---------------------------------------------------------------------
 * STRICT NORMALIZATION RULES
 * ---------------------------------------------------------------------
 *
 * 1. The schema is a STRUCTURAL description of on-disk bytes.
 *    - The normalizer trusts that emitter output has already been
 *      validated by the EmitterRegistry.
 *    - This function does NOT validate emitter output.
 *
 * 2. The normalizer walks fields in SCHEMA ORDER.
 *    - No skipping
 *    - No reordering
 *    - No inference
 *
 * 3. Field handling is mechanical and 1:1:
 *
 *    - "uint32"     → consumes exactly one `{ int }` body entry
 *    - "uint32[]"   → consumes exactly one `{ array, values }` body entry
 *    - "[{...}]"    → consumes a counted sequence of `{ int }` entries
 *
 * 4. The normalizer MUST NOT:
 *    - derive values
 *    - infer counts
 *    - compensate for missing fields
 *    - special-case box types
 *    - embed MP4 semantics
 *
 * 5. This function performs PROJECTION ONLY.
 *    - All schema conformance and shape validation must occur upstream
 *      (in the EmitterRegistry and extractor registry).
 *
 * ---------------------------------------------------------------------
 * DESIGN INTENT
 * ---------------------------------------------------------------------
 *
 * This normalizer is deliberately BORING.
 *
 * It exists only to place emitter output into the same structural shape
 * as readBoxReport().box so the two can be compared mechanically.
 *
 * Once schema, emitters, and extractors are fully reconciled,
 * this function should become trivial — or unnecessary.
 */
import { getBoxSchemaForPath } from "../../box-schema/boxSchemas.js";

/**
 * normalizeEmitterNodeToSchemaBox
 * ===============================
 *
 * PURE STRUCTURAL NORMALIZATION.
 *
 * This function projects an emitter node into the exact structural
 * shape produced by readBoxReport().box, driven strictly by schema.
 *
 * It does NOT:
 *   - validate correctness
 *   - infer relationships
 *   - compensate for missing schema fields
 *   - embed MP4 semantics
 *   - adapt emitter output
 *
 * Any structural or type errors MUST be caught by the registry layer.
 */
export function normalizeEmitterNodeToSchemaBox(node, registryPath) {

    if (typeof registryPath !== "string" || registryPath.length === 0) {
        throw new Error(
            "normalizeEmitterNodeToSchemaBox: registryPath must be a non-empty string"
        );
    }

    const schema = getBoxSchemaForPath(registryPath);

    const box = {
        type: node.type
    };

    // --------------------------------------------------
    // Header (schema-owned)
    // --------------------------------------------------
    if (schema.headerLayout === "Full") {
        box.header = {
            version: node.version,
            flags: node.flags
        };
    }

    // --------------------------------------------------
    // Fields (STRICT schema order, 1:1)
    // --------------------------------------------------
    box.fields = {};

    let cursor = 0;

    for (const [fieldName, fieldSpec] of Object.entries(schema.fields || {})) {

        // ----------------------------------------------
        // Opaque field
        // ----------------------------------------------
        if (schema.opaque === true) {
            box.fields[fieldName] = node.body[cursor]?.values?.slice();
            cursor += 1;
            continue;
        }

        // ----------------------------------------------
        // Field-level opaque union (envelope field)
        // ----------------------------------------------
        if (fieldSpec === "opaque") {
            box.fields[fieldName] = undefined;
            // do NOT consume node.body
            continue;
        }

        // ----------------------------------------------
        // Scalar field (uint32, etc)
        // ----------------------------------------------
        if (isScalarField(fieldSpec)) {
            box.fields[fieldName] = scalarFieldFromNode(fieldSpec, node.body[cursor]);
            cursor += 1;
            continue;
        }

        // ----------------------------------------------
        // Array field (uint32[])
        // ----------------------------------------------
        if (isArrayField(fieldSpec)) {
            box.fields[fieldName] = node.body[cursor]?.values?.slice();
            cursor += 1;
            continue;
        }

        // ----------------------------------------------
        // Structured table ([{...}])
        // ----------------------------------------------
        if (isStructuredTableField(fieldSpec)) {

            const entryCount = box.fields.entryCount;

            const result =
                normalizeStructuredTableField(
                    node,
                    fieldSpec,
                    cursor,
                    entryCount
                );

            box.fields[fieldName] = result.entries;
            cursor = result.nextCursor;
            continue;
        }

        throw new Error(
            `normalizeEmitterNodeToSchemaBox: unsupported field schema for '${fieldName}' ` +
            `in '${registryPath}'`
        );
    }

    // --------------------------------------------------
    // Children (containers only)
    // --------------------------------------------------
    if (schema.structuralRole === "container") {
        box.children = {};

        for (const child of (node.children || [])) {
            if (!child || typeof child.type !== "string") {
                throw new Error(
                    `normalizeEmitterNodeToSchemaBox: invalid child node in '${registryPath}'`
                );
            }

            box.children[child.type] = {
                type: child.type
            };
        }
    }

    return box;
}

// ---------------------------------------------------------------------------
// Field family helpers
// ---------------------------------------------------------------------------
function isScalarField(fieldSchema) {
    return typeof fieldSchema === "string" &&
           fieldSchema !== "scalar" &&
           fieldSchema !== "opaque" &&
           !fieldSchema.endsWith("[]");
}

function isArrayField(fieldSchema) {
    return typeof fieldSchema === "string" &&
           fieldSchema.endsWith("[]");
}

function isStructuredTableField(fieldSchema) {
    return Array.isArray(fieldSchema) &&
           typeof fieldSchema[0] === "object";
}

// ---------------------------------------------------------------------------
// Structured table normalization
// ---------------------------------------------------------------------------
function normalizeStructuredTableField(
    node,
    fieldSchema,
    cursor,
    entryCount
) {
    const entryShape = fieldSchema[0];
    const fieldNames = Object.keys(entryShape);

    const entries = [];

    for (let i = 0; i < entryCount; i++) {
        const entry = {};

        for (const name of fieldNames) {
            const fieldSpec = entryShape[name];
            const field = node.body[cursor];

            // typed scalar (uint32, int32, uint16, etc)
            if (isScalarField(fieldSpec)) {
                entry[name] = scalarFieldFromNode(fieldSpec, field);
                cursor += 1;
                continue;
            }

            // untyped scalar
            if (fieldSpec === "scalar") {
                if ("int" in field) {
                    entry[name] = field.int;
                }
                else if ("short" in field) {
                    entry[name] = field.short;
                }
                else if ("byte" in field) {
                    entry[name] = field.byte;
                }
                else if ("uint64" in field) {
                    entry[name] = field.uint64;
                }
                else if ("int64" in field) {
                    entry[name] = field.int64;
                }
                else {
                    throw new Error(
                        `normalizeEmitterNodeToSchemaBox: unsupported scalar field shape for '${name}'`
                    );
                }

                cursor += 1;
                continue;
            }

            // opaque
            if (fieldSpec === "opaque") {
                entry[name] = {
                    array: "byte",
                    values: field?.values?.slice()
                };
                cursor += 1;
                continue;
            }

            throw new Error(
                `normalizeEmitterNodeToSchemaBox: unsupported structured field type ` +
                `'${fieldSpec}' for field '${name}'`
            );
        }

        entries.push(entry);
    }

    return { entries, nextCursor: cursor };
}

// ---------------------------------------------------------------------------
// Helpers 
// ---------------------------------------------------------------------------
//
function scalarFieldFromNode(fieldSpec, field) {
    if (!field) return undefined;

    switch (fieldSpec) {
        case "uint8":  return field.byte;
        case "int16":  return field.short;
        case "uint16": return field.short;
        case "int32":  return field.int;
        case "uint32": return field.int;
        case "fourcc": return field.type;
        default:       return undefined;
    }
}
