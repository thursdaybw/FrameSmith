export const EMITTER_REGISTRY_VALIDATION_CASES = [

/**
 * EMITTER REGISTRY VALIDATION CASES
 * =================================
 *
 * IMPORTANT NOTE ON FIELD ORDER VALIDATION
 * ---------------------------------------
 *
 * Field order validation is enforced only where it is *provable*.
 *
 * For boxes whose schema defines multiple scalar fields of the same
 * DSL kind and width (e.g. vmhd: four uint16 fields), the validator
 * cannot distinguish field identity by structure alone.
 *
 * In these cases:
 *   - Reordered scalar fields are structurally indistinguishable
 *   - Order violations cannot be detected without additional metadata
 *
 * Therefore:
 *   - Field order tests for such schemas are intentionally excluded
 *   - This is a conscious limitation of the current DSL, not a bug
 *
 * Future direction (not implemented):
 *   - Extend the DSL to allow field identity tagging, e.g.
 *       { short: 0, field: "graphicsmode" }
 *   - This would make strict field order enforcement provable
 *
 * Until then, the validator enforces:
 *   - Cardinality
 *   - Type correctness
 *   - Structural ordering where distinguishable
 *
 * And rejects only what it can *soundly* prove to be invalid.
 */

/* ================================================================
 * A. PATH RESOLUTION & REGISTRATION
 * ================================================================ */
{
    id: "emit.unknown-path",
    api: "emit",
    path: "no/such/path",
    expect: "throw"
},
{
    id: "assemble.unknown-path",
    api: "assemble",
    path: "no/such/path",
    expect: "throw"
},

/* ================================================================
 * B. STRUCTURAL ROLE ENFORCEMENT
 * ================================================================ */
{
    id: "emit.container",
    api: "emit",
    path: "moov/trak/mdia/minf", // container
    expect: "throw"
},
{
    id: "assemble.terminal",
    api: "assemble",
    path: "moov/trak/mdia/minf/vmhd", // terminal
    expect: "throw"
},

/* ================================================================
 * C. EMITTER RETURN SHAPE
 * ================================================================ */
{
    id: "emit.non-object-node",
    api: "emit",
    path: "moov/trak/mdia/minf/vmhd",
    node: null,
    expect: "throw"
},
{
    id: "emit.missing-body",
    api: "emit",
    path: "moov/trak/mdia/minf/vmhd",
    node: { type: "vmhd", version: 0, flags: 1 },
    expect: "throw"
},

/* ================================================================
 * D. FIELD CARDINALITY (vmhd)
 * ================================================================ */
{
    id: "vmhd.too-many-fields",
    api: "emit",
    path: "moov/trak/mdia/minf/vmhd",
    node: {
        type: "vmhd",
        version: 0,
        flags: 1,
        body: [
            { short: 0 },
            { short: 0 },
            { short: 0 },
            { short: 0 },
            { short: 0 }
        ]
    },
    expect: "throw"
},
{
    id: "vmhd.too-few-fields",
    api: "emit",
    path: "moov/trak/mdia/minf/vmhd",
    node: {
        type: "vmhd",
        version: 0,
        flags: 1,
        body: [
            { short: 0 },
            { short: 0 },
            { short: 0 }
        ]
    },
    expect: "throw"
},

/* ================================================================
 * E. SCALAR TYPE ENFORCEMENT (uint16 → short)
 * ================================================================ */
{
    id: "vmhd.correct-scalar",
    api: "emit",
    path: "moov/trak/mdia/minf/vmhd",
    node: {
        type: "vmhd",
        version: 0,
        flags: 1,
        body: [
            { short: 0 },
            { short: 0 },
            { short: 0 },
            { short: 0 }
        ]
    },
    expect: "pass"
},
{
    id: "vmhd.wrong-scalar-type",
    api: "emit",
    path: "moov/trak/mdia/minf/vmhd",
    node: {
        type: "vmhd",
        version: 0,
        flags: 1,
        body: [
            { int: 0 },   // wrong
            { short: 0 },
            { short: 0 },
            { short: 0 }
        ]
    },
    expect: "throw"
},

/* ================================================================
 * F+. FIELD-LEVEL OPAQUE (scalar position)
 * ================================================================ */

/**
 * Field-level opaque means:
 * - schema fieldSpec === "opaque"
 * - emitter provides raw byte payload
 * - represented as { array: "byte", values: [...] }
 *
 * This is distinct from:
 * - box-level opaque
 * - repeated opaque[]
 */

{
    id: "opaque.field.accepts-byte-array",
    api: "emit",
    path: "moov/udta/meta/ilst/©too/data",
    node: {
        type: "data",
        version: 0,
        flags: 0,
        body: [
            { int: 1 },                 // dataType
            { int: 0 },                 // locale
            { array: "byte", values: [1, 2, 3] } // opaque value
        ]
    },
    expect: "pass"
},
{
    id: "opaque.field.rejects-scalar",
    api: "emit",
    path: "moov/udta/meta/ilst/©too/data",
    node: {
        type: "data",
        version: 0,
        flags: 0,
        body: [
            { int: 1 },
            { int: 0 },
            { int: 123 } // illegal for opaque
        ]
    },
    expect: "throw"
},

/* ================================================================
 * I. FIELD ORDER ENFORCEMENT
 * ================================================================ */
// NOTE: vmhd field order is not provable with the current DSL.
// See header comment above.
//
// {
//     id: "vmhd.fields-swapped",
//     api: "emit",
//     path: "moov/trak/mdia/minf/vmhd",
//     node: {
//         type: "vmhd",
//         version: 0,
//         flags: 1,
//         body: [
//             { short: 0 },
//             { short: 0 },
//             { short: 0 },
//             { short: 0 }
//         ].reverse()
//     },
//     expect: "throw"
// },

/* ================================================================
 * I+. COUNT / DEPENDENCY ADJACENCY (PROVABLE)
 * ================================================================ */
{
    id: "count-not-immediately-preceding-dependent-field",
    api: "emit",
    path: "moov/trak/mdia/minf/stbl/sgpd",
    node: {
        type: "sgpd",
        version: 1,
        flags: 0,
        body: [
            { type: "roll" },      // grouping_type
            { int: 1 },            // entry_count (wrong position)
            { int: 0 },            // default_length
            { array: "byte", values: [0x00] }
        ]
    },
    expect: "throw"
},

/* ================================================================
 * J. FINAL EXHAUSTIVENESS
 * ================================================================ */
{
    id: "vmhd.surplus-payload",
    api: "emit",
    path: "moov/trak/mdia/minf/vmhd",
    node: {
        type: "vmhd",
        version: 0,
        flags: 1,
        body: [
            { short: 0 },
            { short: 0 },
            { short: 0 },
            { short: 0 },
            { byte: 0 }
        ]
    },
    expect: "throw"
}

];
