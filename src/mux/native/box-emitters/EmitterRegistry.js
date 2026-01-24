import { getBoxSchemaForPath } from "../box-schema/boxSchemas.js";

/**
 * Emitter / Assembler Registry
 * ============================
 *
 * What this file is
 * -----------------
 *
 * This registry is the single, authoritative entry point for building MP4 boxes
 * in this system.
 *
 * It does NOT write bytes.
 * It does NOT parse bytes.
 *
 * It enforces *how boxes are allowed to be constructed*.
 *
 * If you are looking for serialization, see the box emitters.
 * If you are looking for parsing, see the extractors.
 *
 *
 * Core idea
 * ---------
 *
 * Every MP4 box has a canonical schema path and a declared structural role:
 *
 *   - terminal  → leaf boxes (no children, only fields or opaque payload)
 *   - container → boxes that contain other boxes
 *
 * The schema is the source of truth.
 * Callers do NOT get to decide how a box is built.
 *
 *
 * There are two public entry points
 * --------------------------------
 *
 *   1. emit(path, input)
 *   2. assemble(path, input)
 *
 * Which one you are allowed to call depends entirely on the schema.
 *
 *
 * emit(path, input)
 * -----------------
 *
 * Public API.
 *
 * Used to build TERMINAL boxes only.
 *
 * If you try to call emit() for a container box, it will throw.
 *
 * Example (from tests or other trusted callers):
 *
 *   const avcCNode =
 *       EmitterRegistry.emit(
 *           "moov/trak/mdia/minf/stbl/stsd|avc1/avcC",
 *           { avcC: rawAvcCBytes }
 *       );
 *
 *
 * assemble(path, input)
 * ---------------------
 *
 * Public API.
 *
 * Used to build CONTAINER boxes only.
 *
 * If you try to call assemble() for a terminal box, it will throw.
 *
 * Example:
 *
 *   const avc1Node =
 *       EmitterRegistry.assemble(
 *           "moov/trak/mdia/minf/stbl/stsd|avc1",
 *           {
 *               width:  1920,
 *               height: 1080,
 *               avcC:   rawAvcCBytes
 *           }
 *       );
 *
 *
 * What assemblers are allowed to do
 * --------------------------------
 *
 * Assemblers are trusted builders.
 *
 * They are NOT allowed to call EmitterRegistry.emit() directly.
 *
 * Instead, when assemble() is called, the registry injects a private capability
 * into the assembler:
 *
 *   emitContainer(path, input)
 *
 * This function can emit:
 *
 *   - terminal child boxes
 *   - container boxes
 *   - the assembler’s *own* container box
 *
 * This capability ONLY exists while the assembler is running.
 * Tests and external callers never receive it.
 *
 *
 * Example assembler signature:
 *
 *   function assembleAvc1(intent, { emitContainer }) {
 *
 *       const avcCNode =
 *           emitContainer(
 *               "moov/trak/mdia/minf/stbl/stsd|avc1/avcC",
 *               { avcC: intent.avcC }
 *           );
 *
 *       return emitContainer(
 *           "moov/trak/mdia/minf/stbl/stsd|avc1",
 *           {
 *               width:  intent.width,
 *               height: intent.height,
 *               avcCNode
 *           }
 *       );
 *   }
 *
 *
 * Why this design exists
 * ----------------------
 *
 * This registry deliberately prevents a whole class of bugs:
 *
 *   - Tests accidentally emitting container boxes
 *   - Assemblers bypassing schema rules
 *   - Callers choosing the wrong construction path
 *
 * Illegal states are made unrepresentable.
 *
 * If something is built the wrong way, it fails early, loudly, and with a
 * specific error.
 *
 *
 * Validation
 * ----------
 *
 * Every emitter output is validated against the schema:
 *
 *   - field order
 *   - field size
 *   - scalar vs array vs opaque payload
 *   - structured tables
 *
 * This validation happens immediately after construction.
 *
 * If a box is malformed, it never enters the system.
 *
 *
 * Registration
 * ------------
 *
 * Emitters and assemblers are registered via wiring tables:
 *
 *   - EMITTER_WIRING
 *   - ASSEMBLER_WIRING
 *
 * This keeps registration declarative and avoids hidden side effects.
 *
 *
 * Mental model summary
 * --------------------
 *
 * Think of this registry as a compiler front end:
 *
 *   - The schema is the language spec
 *   - Emitters are code generators
 *   - Assemblers are syntax tree builders
 *   - The registry enforces the rules
 *
 * If you follow the API, things work.
 * If you break the rules, the registry stops you.
 *
 * That is intentional.
 *
 * ============================================================================
 * Structured Tables in the Emitter Registry
 * ============================================================================
 *
 * This note explains, in plain language, why some MP4 boxes (such as ELST,
 * SBGP, and SGPD) are harder to validate than others, what the registry is
 * currently doing, and why this area deserves future review.
 *
 * ---------------------------------------------------------------------------
 * What is a “structured table”?
 * ---------------------------------------------------------------------------
 *
 * Some MP4 boxes contain repeating rows of data.
 *
 * In simple terms, they look like:
 *
 *   1. A count field (how many entries there are)
 *   2. Followed by N entries
 *   3. Each entry has several fields in a fixed order
 *
 * Example (conceptually):
 *   “There are 3 entries, and each entry has 4 numbers.”
 *
 * ELST, SBGP, and SGPD all follow this pattern.
 *
 * ---------------------------------------------------------------------------
 * Why structured tables are harder than normal fields
 * ---------------------------------------------------------------------------
 *
 * For a normal field:
 *   - The schema says the field exists
 *   - The emitter outputs a value
 *   - The registry checks that the value is present and in the right place
 *
 * For structured tables, the registry must additionally:
 *   - Read the entry count
 *   - Loop the correct number of times
 *   - Know how many values each entry expands into
 *   - Walk a flat body array using positional “cursor” logic
 *
 * This makes validation stateful and order-dependent, which increases
 * complexity and makes errors harder to reason about.
 *
 * ---------------------------------------------------------------------------
 * The core problem we hit (important)
 * ---------------------------------------------------------------------------
 *
 * The registry originally tried to validate *how* numbers were encoded
 * (for example: int vs short) instead of just validating that the correct
 * *values and structure* existed.
 *
 * This caused failures even when:
 *   - The numeric values were correct
 *   - The layout matched the MP4 spec
 *   - The output bytes were correct
 *
 * These failures were not semantic MP4 errors, but over-strict validation.
 *
 * ---------------------------------------------------------------------------
 * This was NOT actually a version problem
 * ---------------------------------------------------------------------------
 *
 * Although boxes like ELST have version 0 and version 1 formats, the observed
 * failures happened even when testing only version 0.
 *
 * Version differences merely exposed the real issue earlier.
 *
 * The real issue was enforcing encoding choices instead of structural shape.
 *
 * ---------------------------------------------------------------------------
 * What the registry SHOULD validate
 * ---------------------------------------------------------------------------
 *
 * The registry is responsible for:
 *   - Required fields existing
 *   - Correct field order
 *   - Entry counts matching the number of entries
 *   - No missing or surplus payload data
 *
 * ---------------------------------------------------------------------------
 * What the registry SHOULD NOT validate
 * ---------------------------------------------------------------------------
 *
 * The registry should not enforce:
 *   - Whether a number is emitted as int, short, uint32, etc
 *   - Signed vs unsigned arithmetic semantics
 *   - Exact byte-level encoding decisions
 *
 * Those concerns belong to:
 *   - Emitters (semantic intent)
 *   - The serializer (byte encoding)
 *   - Locked-layout equivalence tests (ground truth)
 *
 * ---------------------------------------------------------------------------
 * Current state
 * ---------------------------------------------------------------------------
 *
 * - Structured tables for ELST, SBGP, and SGPD work
 * - Tests pass
 * - Schema validation has been relaxed to the correct responsibility level
 * - No active schema variants are required for ELST
 *
 * The system is stable, but this area is a known pressure point.
 *
 * ---------------------------------------------------------------------------
 * Future review needed
 * ---------------------------------------------------------------------------
 *
 * This code would benefit from a future redesign that:
 *   - Reduces cursor-based validation
 *   - Makes table structures more declarative
 *   - Separates structural validation from encoding decisions
 *   - Produces clearer error messages
 *
 * Possible future directions include:
 *   - Row-based table representations instead of flat bodies
 *   - Registry helpers dedicated to repeated entry validation
 *   - Clearer boundaries between “shape” and “encoding”
 *
 * ---------------------------------------------------------------------------
 * Summary
 * ---------------------------------------------------------------------------
 *
 * Structured tables are conceptually simple (they are just repeated rows),
 * but become complex when structure validation and encoding validation are
 * mixed together.
 *
 * That mixing caused unnecessary friction.
 *
 * The current approach restores correct separation of concerns, but this
 * area should be revisited when refactoring or extending the registry.
 *
 * ============================================================================
 */
import { EMITTER_WIRING } from "./EMITTER_WIRING.js";
import { ASSEMBLER_WIRING } from "./EMITTER_WIRING.js";

export const EmitterRegistry = {

    _assemblers: {},
    _emitters: {},

    // ---------------------------------------------------------
    // Registration
    // ---------------------------------------------------------
    registerAssembler(path, assemblerFn) {
        if (this._assemblers[path]) {
            throw new Error(
                `EmitterRegistry: An assembler is already registered for '${path}'.`
            );
        }

        if (typeof assemblerFn !== "function") {
            throw new Error(
                `EmitterRegistry: Registration for '${path}' requires a function.\n` +
                `The provided assembler is not callable.`
            );
        }

        this._assemblers[path] = assemblerFn;
    },

    registerEmitter(path, emitterFn) {
        if (this._emitters[path]) {
            throw new Error(
                `EmitterRegistry: An emitter is already registered for '${path}'.`
            );
        }

        if (typeof emitterFn !== "function") {
            throw new Error(
                `EmitterRegistry: Registration for '${path}' requires a function.\n` +
                `The provided emitter is not callable.`
            );
        }

        this._emitters[path] = emitterFn;
    },

    // ---------------------------------------------------------
    // Internal emit (full authority, not exported)
    // ---------------------------------------------------------
    _emitInternal(path, input) {
        const schema = getBoxSchemaForPath(path);
        if (!schema) {
            throw new Error(`EmitterRegistry: No schema for '${path}'.`);
        }

        let emitter = this._emitters[path];

        if (!emitter) {
            for (const [registeredPath, fn] of Object.entries(this._emitters)) {
                if (!registeredPath.includes("{atom}")) continue;

                const regex = new RegExp(
                    "^" + registeredPath.replace("{atom}", "([^/]{4})") + "$"
                );

                if (regex.test(path)) {
                    emitter = fn;
                    break;
                }
            }
        }

        if (!emitter) {
            throw new Error(
                `EmitterRegistry: No emitter registered for '${path}'.`
            );
        }

        if (!emitter) {
            throw new Error(
                `EmitterRegistry: No emitter registered for '${path}'.`
            );
        }

        const node = emitter(input);
        validateEmitterNodeAgainstSchema(node, schema, path);
        return node;
    },

    // ---------------------------------------------------------
    // Emit (public, terminal-only)
    // ---------------------------------------------------------
    emit(path, input) {
        const schema = getBoxSchemaForPath(path);
        if (!schema) {
            throw new Error(`EmitterRegistry: No schema for '${path}'.`);
        }

        if (schema.structuralRole !== "terminal") {
            throw new Error(
                `EmitterRegistry.emit(): illegal call for '${path}'.\n` +
                `\n` +
                `This box is defined as a *container* in the schema.\n` +
                `Container boxes do not emit themselves.\n` +
                `\n` +
                `Why:\n` +
                `- Containers are structural nodes that exist to wire child boxes together.\n` +
                `- Emitting a container directly would bypass required child assembly rules.\n` +
                `\n` +
                `What to do instead:\n` +
                `- Call EmitterRegistry.assemble('${path}', intent)\n` +
                `- Implement or use the registered assembler for this path\n` +
                `- Inside the assembler, build child boxes using the provided emitContainer() helper`
            );

        }

        return this._emitInternal(path, input);
    },

    // ---------------------------------------------------------
    // Assemble (public, container-only, injects capability)
    // ---------------------------------------------------------
    assemble(path, input) {
        const schema = getBoxSchemaForPath(path);
        if (!schema) {
            throw new Error(`EmitterRegistry: No schema for '${path}'.`);
        }

        if (schema.structuralRole !== "container") {
            throw new Error(
                `EmitterRegistry.assemble(): '${path}' is not a container box.`
            );
        }

        const assembler = this._assemblers[path];
        if (!assembler) {
            throw new Error(
                `EmitterRegistry: No assembler registered for '${path}'.`
            );
        }

        const emitContainer = (childPath, childInput) => {
            return this._emitInternal(childPath, childInput);
        };

        const node = assembler(input, { emitContainer });
        validateEmitterNodeAgainstSchema(node, schema, path);
        return node;
    },

    // ---------------------------------------------------------
    // Introspection (for tests)
    // ---------------------------------------------------------
    __getRegisteredPaths() {
        return {
            assemblers: Object.keys(this._assemblers),
            emitters: Object.keys(this._emitters),
        };
    }
};

export function registerBuilders(registry) {

    for (const [path, installer] of EMITTER_WIRING) {
        if (typeof installer !== "function") {
            throw new Error(
                `registerBuilders: Emitter registration for '${path}' requires a function.`
            );
        }
        installer(registry);
    }

    for (const [path, installer] of ASSEMBLER_WIRING) {
        if (typeof installer !== "function") {
            throw new Error(
                `registerBuilders: Assembler registration for '${path}' requires a function.`
            );
        }
        installer(registry);
    }
}

registerBuilders(EmitterRegistry);


// -----------------------------------------------------------------------------
// Field Validators
// -----------------------------------------------------------------------------

function isScalarField(fieldSchema) {
    return typeof fieldSchema === "string" &&
        !fieldSchema.endsWith("[]");
}

function isArrayField(fieldSchema) {
    return typeof fieldSchema === "string" &&
        fieldSchema.endsWith("[]");
}

function isOpaqueArrayField(fieldSpec) {
    return fieldSpec === "opaque[]";
}

function isStructuredTableField(fieldSchema) {
    return Array.isArray(fieldSchema) &&
        typeof fieldSchema[0] === "object";
}

function schemaScalarToDslKind(fieldSpec) {
    switch (fieldSpec) {
        case "uint8":  return "byte";
        case "uint16": return "short";
        case "int16":  return "short";
        case "uint32": return "int";
        case "int32":  return "int";
        case "fourcc": return "type";
        default:       return null;
    }
}

function schemaArrayToDslKind(fieldSpec) {
    if (!fieldSpec.endsWith("[]")) return null;

    const base = fieldSpec.slice(0, -2);

    switch (base) {
        case "uint8":  return "byte";
        case "uint16": return "short";
        case "uint32": return "int";
        default:       return null;
    }
}

function describeEmitterField(field) {
    if (!field || typeof field !== "object") return typeof field;
    if ("int" in field)   return "int";
    if ("short" in field) return "short";
    if ("byte" in field)  return "byte";
    if ("array" in field) return `array(${field.array})`;
    if ("box" in field)   return "box";
    return "object";
}

function schemaTypeDescription(fieldSpec) {
    if (typeof fieldSpec === "string") return fieldSpec;
    if (Array.isArray(fieldSpec)) return "structured table";
    return "unknown";
}

function assertScalarField(node, cursor, fieldName, fieldSpec, registryPath) {
    const field = node.body[cursor];
    const expectedKind = schemaScalarToDslKind(fieldSpec);

    if (!field || !(expectedKind in field)) {
        const got = describeEmitterField(field);

        const expectation =
            expectedKind === "type"
                ? "a FourCC literal { type: \"abcd\" }"
                : `one ${expectedKind}-sized integer value`;

        throw new Error(
            `EmitterRegistry: Schema defines field '${fieldName}' in '${registryPath}' as ${fieldSpec}, ` +
            `but the emitter gave ${got} instead.\n` +
            `(expected ${expectation})`
        );
    }
}

function assertArrayField(node, cursor, fieldName, fieldSpec, registryPath) {
    const field = node.body[cursor];
    const expectedKind = schemaArrayToDslKind(fieldSpec);

    if (
        !field ||
        !Array.isArray(field.values) ||
        field.array !== expectedKind
    ) {
        const got = describeEmitterField(field);
        throw new Error(
            `EmitterRegistry: Schema defines field '${fieldName}' in '${registryPath}' as ${fieldSpec}, ` +
            `but the emitter gave ${got} instead.\n` +
            `(expected an array of ${expectedKind}-sized integers)`
        );
    }
}

function assertOpaqueField(node, cursor, registryPath) {
    const field = node.body[cursor];

    if (!field || !Array.isArray(field.values)) {
        const got = describeEmitterField(field);
        throw new Error(
            `EmitterRegistry: Schema defines '${registryPath}' as opaque payload, ` +
            `but the emitter gave ${got} instead.\n` +
            `(expected raw byte array payload)`
        );
    }
}

function assertStructuredTableField(
    node,
    fieldSchema,
    cursor,
    entryCount,
    registryPath
) {
    const entryShape = fieldSchema[0];
    const fieldNames = Object.keys(entryShape);

    if (!Number.isInteger(entryCount)) {
        throw new Error(
            `EmitterRegistry: Schema defines a structured table in '${registryPath}', ` +
            `but no valid entryCount was provided.\n` +
            `(expected a preceding integer count field)`
        );
    }

    let localCursor = cursor;

    for (let i = 0; i < entryCount; i++) {
        for (const name of fieldNames) {

            const field = node.body[localCursor];

            // opaque is still special
            if (entryShape[name] === "opaque") {
                if (
                    !field ||
                    field.array !== "byte" ||
                    !Array.isArray(field.values)
                ) {
                    const got = describeEmitterField(field);
                    throw new Error(
                        `EmitterRegistry: Schema defines structured field '${name}' ` +
                        `in '${registryPath}' as opaque, but the emitter gave ${got}.`
                    );
                }
            }
            else {
                // scalar field: accept ANY scalar emitter token
                if (
                    !field ||
                    typeof field !== "object" ||
                    (
                        !("int" in field) &&
                        !("short" in field) &&
                        !("byte" in field) &&
                        !("int64" in field) &&
                        !("uint64" in field)
                    )
                ) {
                    const got = describeEmitterField(field);
                    throw new Error(
                        `EmitterRegistry: Schema defines structured field '${name}' ` +
                        `in '${registryPath}' as scalar, but the emitter gave ${got}.`
                    );
                }
            }

            localCursor += 1;
        }
    }

    return localCursor;
}

function validateEmitterNodeAgainstSchema(node, schema, registryPath) {

    if (!node || typeof node !== "object") {
        throw new Error(
            `EmitterRegistry: emitter for '${registryPath}' did not return an object`
        );
    }

    // Normalize empty body for optional payloads
    if (
        schema.structuralRole === "terminal" &&
        schema.payloadRequirement === "optional" &&
        Array.isArray(node.body) &&
        node.body.length === 0
    ) {
        delete node.body;
    }

    const hasDeclaredFields = schema.fields && Object.keys(schema.fields).length > 0;

    const hasBody = Array.isArray(node.body) && node.body.length > 0;

    let payloadRequirement = schema.payloadRequirement;

    if (!payloadRequirement) {
        if (hasDeclaredFields) {
            payloadRequirement = "required";
        } else {
            payloadRequirement = "forbidden";
        }
    }

    // Body presence check must respect payloadRequirement
    if (schema.structuralRole === "terminal") {
        if (payloadRequirement === "required" && !hasBody) {
            throw new Error(
                `EmitterRegistry: '${registryPath}' requires payload, ` +
                `but emitter produced none.`
            );
        }

        if (payloadRequirement === "forbidden" && hasBody) {
            throw new Error(
                `EmitterRegistry: '${registryPath}' forbids payload, ` +
                `but emitter produced body data.`
            );
        }
    }


    if (!payloadRequirement) {
        if (schema.fields && Object.keys(schema.fields).length > 0) {
            payloadRequirement = "required";
        } else {
            payloadRequirement = "forbidden";
        }
    }

    if (schema.structuralRole === "terminal") {

        const hasBody = Array.isArray(node.body);

        if (payloadRequirement === "forbidden" && hasBody) {
            throw new Error(
                `EmitterRegistry: '${registryPath}' forbids payload, ` +
                `but emitter produced body data.`
            );
        }

        if (payloadRequirement === "required" && !hasBody) {
            throw new Error(
                `EmitterRegistry: '${registryPath}' requires payload, ` +
                `but emitter produced none.`
            );
        }

        // "optional" → no check
    }

    let cursor = 0;
    const fields = schema.fields || {};

    let previousFieldName = null;

    // ---------------------------------------------------------
    // Field validation only applies if payload is present
    // ---------------------------------------------------------
    if (!Array.isArray(node.body)) {
        return;
    }

    for (const [fieldName, fieldSpec] of Object.entries(fields)) {

        // Opaque payload
        if (schema.opaque === true) {
            assertOpaqueField(node, cursor, registryPath);
            cursor += 1;
            previousFieldName = fieldName;
            continue;
        }

        // Field-level opaque (single-slot)
        if (fieldSpec === "opaque") {
            const field = node.body[cursor];

            if (
                !field ||
                field.array !== "byte" ||
                !Array.isArray(field.values)
            ) {
                const got = describeEmitterField(field);
                throw new Error(
                    `EmitterRegistry: Schema defines field '${fieldName}' in '${registryPath}' as opaque, ` +
                    `but the emitter gave ${got} instead.\n` +
                    `(expected raw byte array payload)`
                );
            }

            cursor += 1;
            previousFieldName = fieldName;
            continue;
        }

        // Scalar field
        if (isScalarField(fieldSpec)) {
            assertScalarField(node, cursor, fieldName, fieldSpec, registryPath);
            cursor += 1;
            previousFieldName = fieldName;
            continue;
        }

        // Array field
        if (isArrayField(fieldSpec)) {

            // Repeated opaque payloads driven by entryCount (sgpd)
            if (isOpaqueArrayField(fieldSpec) && previousFieldName === "entryCount") {

                const countField = node.body[cursor - 1];

                if (!countField || typeof countField.int !== "number") {
                    throw new Error(
                        `EmitterRegistry: '${fieldName}' in '${registryPath}' ` +
                        `must be preceded by an integer entryCount field`
                    );
                }

                const entryCount = countField.int;

                for (let i = 0; i < entryCount; i++) {
                    const field = node.body[cursor + i];

                    if (!field || !Array.isArray(field.values)) {
                        const got = describeEmitterField(field);
                        throw new Error(
                            `EmitterRegistry: Schema defines '${fieldName}' in '${registryPath}' ` +
                            `as repeated opaque[], but the emitter gave ${got} instead.\n` +
                            `(expected ${entryCount} opaque byte payloads)`
                        );
                    }
                }

                cursor += entryCount;
                previousFieldName = fieldName;
                continue;
            }

            // Normal single-slot typed array field (uint8[], uint16[], etc)
            assertArrayField(node, cursor, fieldName, fieldSpec, registryPath);
            cursor += 1;
            previousFieldName = fieldName;
            continue;
        }
        // Structured table
        if (isStructuredTableField(fieldSpec)) {

            const countField = node.body[cursor - 1];

            if (!countField || typeof countField.int !== "number") {
                throw new Error(
                    `EmitterRegistry: structured table in '${registryPath}' ` +
                    `must be preceded by an integer entry count field`
                );
            }

            const entryCount = countField.int;

            cursor = assertStructuredTableField(
                node,
                fieldSpec,
                cursor,
                entryCount,
                registryPath
            );

            previousFieldName = fieldName;
            continue;
        }

        throw new Error(
            `EmitterRegistry: Unsupported schema field '${fieldName}' in '${registryPath}'.`
        );
    }

    // ---------------------------------------------------------
    // Opaque terminal payload consumes exactly one body slot
    // ---------------------------------------------------------
    if (schema.opaque === true) {

        if (!Array.isArray(node.body)) {
            throw new Error(
                `EmitterRegistry: '${registryPath}' requires opaque payload, ` +
                `but emitter produced none.`
            );
        }

        if (node.body.length !== 1) {
            throw new Error(
                `EmitterRegistry: '${registryPath}' expects exactly one opaque payload field, ` +
                `but emitter produced ${node.body.length}.`
            );
        }

        // opaque payload fully validated here
        return;
    }

    // ---------------------------------------------------------
    // Final exhaustiveness check (NO surplus payload allowed)
    // ---------------------------------------------------------
    if (Array.isArray(node.body) && cursor !== node.body.length) {
        throw new Error(
            `EmitterRegistry: emitter for '${registryPath}' produced ` +
            `${node.body.length} body fields, but schema defines ${cursor}.\n` +
            `Unexpected payload at body index ${cursor}.`
        );
    }
}
