import {
    assertEqual,
    assertExists
} from "../../tests/assertions.js";

import {
    applyUdtaPolicy
} from "../../policies/applyUdtaPolicy.js";

import { EmitterRegistry } from "../../box-emitters/EmitterRegistry.js";

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

    const udtaIntent = applyUdtaPolicy({
        encoderIdentity: "NativeMuxer"
    });

    assertExists(
        "semantic udta intent",
        udtaIntent
    );

    // ---------------------------------------------------------
    // Emit via registry (no direct structure inspection)
    // ---------------------------------------------------------
    const udtaNode = EmitterRegistry.assemble(
            "moov/udta",
            udtaIntent
        );

    assertExists(
        "emitted udta node",
        udtaNode
    );

    assertEqual(
        "udta.type",
        udtaNode.type,
        "udta"
    );

    assertEqual(
        "udta not opaque",
        "__opaque" in udtaNode,
        false
    );

    assertExists(
        "udta.children",
        udtaNode.children
    );

    assertEqual(
        "udta.children is array",
        Array.isArray(udtaNode.children),
        true
    );

    assertEqual(
        "udta.children length",
        udtaNode.children.length,
        1
    );

    assertEqual(
        "first child type",
        udtaNode.children[0].type,
        "meta"
    );
}
