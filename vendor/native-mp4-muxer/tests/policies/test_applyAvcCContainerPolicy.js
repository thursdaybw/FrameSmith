/**
 * test_applyAvcCContainerPolicy
 * =============================
 *
 * Isolated, locked-layout tests for the AVCDecoderConfigurationRecord
 * container completion policy.
 *
 * PURPOSE
 * -------
 * These tests verify that applyAvcCContainerPolicy:
 *
 *   - completes SEMANTIC avcC payloads when required
 *   - preserves CONTAINER-COMPLETE avcC payloads
 *   - applies no transformation when policy is not applicable
 *
 * This test:
 *   - does NOT involve MP4 box emission
 *   - does NOT involve source adapters
 *   - does NOT involve compiler orchestration
 *
 * It locks byte-level behavior of the policy in isolation.
 *
 * If this test passes, the policy is trusted.
 */

import {
    applyAvcCContainerPolicySemantic,
    applyAvcCContainerPolicyContainerComplete,
} from "../../policies/applyAvcCContainerPolicy.js";

import {
    assertArrayEqual
} from "../assertions.js";

/**
 * Golden avcC fixtures
 *
 * These are extracted once from a known-good ffmpeg MP4
 * and hard-coded here to lock behavior.
 *
 * They MUST NOT be derived inside the test.
 */

// Semantic-only avcC (High Profile, NO extension bytes)
const SEMANTIC_HIGH_PROFILE_AVCC = new Uint8Array([
    /* version */                 0x01,
    /* profile */                 0x64, // 100 (High)
    /* profile_compat */          0x00,
    /* level */                   0x1E,
    /* lengthSizeMinusOne */      0xFF,

    /* SPS count */               0xE1,
    /* SPS length */              0x00, 0x19,
    /* SPS bytes (truncated) */   0x67, 0x64, 0x00, 0x1E,
                                 0xAC, 0xD9, 0x40, 0x78,
                                 0x02, 0x27, 0xE5, 0xC0,
                                 0x44, 0x00, 0x00, 0x03,
                                 0x00, 0x04, 0x00, 0x00,
                                 0x03, 0x00, 0xCA, 0x3C,
                                 0x48,

    /* PPS count */               0x01,
    /* PPS length */              0x00, 0x04,
    /* PPS bytes */               0x68, 0xEE, 0x3C, 0x80
]);

// Container-complete avcC (same as above + ffmpeg High Profile extension)
const CONTAINER_COMPLETE_HIGH_PROFILE_AVCC = new Uint8Array([
    ...SEMANTIC_HIGH_PROFILE_AVCC,

    /* chroma_format_idc */        0xFD, // 0xFC | 1
    /* bit_depth_luma_minus8 */    0xF8,
    /* bit_depth_chroma_minus8 */  0xF8,
    /* reserved */                 0x00
]);

// Baseline profile avcC (profile < 100)
const SEMANTIC_BASELINE_AVCC = new Uint8Array([
    0x01, 0x42, 0x00, 0x1E, 0xFF,
    0xE1, 0x00, 0x0A,
    0x67, 0x42, 0x00, 0x1E,
    0x95, 0xA8, 0x14, 0x01,
    0x6E, 0x9B,
    0x01, 0x00, 0x04,
    0x68, 0xCE, 0x06, 0xE2
]);

export function test_applyAvcCContainerPolicy() {

    // ---------------------------------------------------------
    // Case 1 — Semantic High Profile → Container-complete
    // ---------------------------------------------------------

    const completed = applyAvcCContainerPolicySemantic({
        avcC: SEMANTIC_HIGH_PROFILE_AVCC,
        profileIndication: 100
    });

    assertArrayEqual(
        "semantic High Profile avcC is completed correctly",
        Array.from(completed),
        Array.from(CONTAINER_COMPLETE_HIGH_PROFILE_AVCC)
    );

    // ---------------------------------------------------------
    // Case 2 — Container-complete High Profile → unchanged
    // ---------------------------------------------------------
    const preserved = applyAvcCContainerPolicyContainerComplete({
        avcC: CONTAINER_COMPLETE_HIGH_PROFILE_AVCC
    });

    assertArrayEqual(
        "container-complete avcC is preserved",
        Array.from(preserved),
        Array.from(CONTAINER_COMPLETE_HIGH_PROFILE_AVCC)
    );

    // ---------------------------------------------------------
    // Case 3 — Baseline Profile → unchanged
    // ---------------------------------------------------------
    const baseline = applyAvcCContainerPolicySemantic({
        avcC: SEMANTIC_BASELINE_AVCC,
        profileIndication: 66
    });

    assertArrayEqual(
        "baseline profile avcC is unchanged",
        Array.from(baseline),
        Array.from(SEMANTIC_BASELINE_AVCC)
    );

}
