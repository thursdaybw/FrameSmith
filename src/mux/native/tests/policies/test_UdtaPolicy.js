import {
    assertEqual,
    assertExists
} from "../../tests/assertions.js";

import {
    applyUdtaPolicy
} from "../../policies/applyUdtaPolicy.js";

/*
 * =========================================================
 * UdtaPolicy — Boundary Tests
 * =========================================================
 *
 * These tests assert ONLY policy-level responsibilities:
 *
 *   - whether udta is emitted or omitted
 *   - whether udta is opaque or structured
 *   - whether raw bytes are preserved verbatim
 *
 * They intentionally do NOT assert:
 *   - metadata encoding details
 *   - box body layout
 *   - child ordering beyond immediate ownership
 *   - emitter-specific semantics
 *
 * If these tests pass, the udta policy boundary is clean.
 */

/* ---------------------------------------------------------
 * Test 1 — Opaque passthrough (historical preservation)
 * ---------------------------------------------------------
 */

export function test_UdtaPolicy_OpaquePassthrough() {

    console.log("=== test_UdtaPolicy_OpaquePassthrough ===");

    const opaque = Uint8Array.from([
        0x00, 0x00, 0x00, 0x08,
        0x75, 0x64, 0x74, 0x61
    ]);

    const result = applyUdtaPolicy({
        opaqueUdta: opaque
    });

    assertExists(
        "opaque udta result",
        result
    );

    assertEqual(
        "udta.type",
        result.type,
        "udta"
    );

    assertExists(
        "udta.bytes",
        result.bytes
    );

    assertEqual(
        "udta.bytes identity",
        result.bytes,
        opaque
    );

    assertEqual(
        "opaque byte identity",
        result.bytes,
        opaque
    );
}

/* ---------------------------------------------------------
 * Test 2 — Explicit omission
 * ---------------------------------------------------------
 */

export function test_UdtaPolicy_ExplicitOmission() {

    console.log("=== test_UdtaPolicy_ExplicitOmission ===");

    const result = applyUdtaPolicy({
        encoderIdentity: ""
    });

    assertEqual(
        "explicit omission",
        result,
        null
    );
}

/* ---------------------------------------------------------
 * Test 3 — Semantic authorship (structure only)
 * ---------------------------------------------------------
 */

export function test_UdtaPolicy_SemanticIdentity_StructureOnly() {

    console.log("=== test_UdtaPolicy_SemanticIdentity_StructureOnly ===");

    const result = applyUdtaPolicy({
        encoderIdentity: "NativeMuxer"
    });

    assertExists(
        "semantic udta result",
        result
    );

    assertEqual(
        "udta.type",
        result.type,
        "udta"
    );

    assertEqual(
        "semantic udta not opaque",
        "__opaque" in result,
        false
    );

    assertExists(
        "udta.children",
        result.children
    );

    assertEqual(
        "udta.children is array",
        Array.isArray(result.children),
        true
    );

    assertEqual(
        "udta.children length",
        result.children.length,
        1
    );

    assertEqual(
        "first child type",
        result.children[0].type,
        "meta"
    );
}
