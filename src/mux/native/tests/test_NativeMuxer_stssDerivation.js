import { deriveStssSampleNumbers } from "../derivers/deriveStssSampleNumbers.js";
import { assertEqual } from "./assertions.js";

/**
 * STSS derivation semantics
 * ========================
 *
 * The Sync Sample Box (`stss`) is OPTIONAL in MP4.
 *
 * Semantic rules:
 *
 *   - If samples include an `isKey` boolean:
 *       → Keyframe semantics are known.
 *       → `stss` MUST be derived from samples.
 *
 *   - If samples DO NOT include `isKey`:
 *       → Keyframe semantics are unknown.
 *       → `stss` MUST NOT be derived.
 *
 * In the latter case, the correct result is an EMPTY list,
 * signalling to the assembler that no `stss` box should be emitted.
 *
 * This file tests BOTH cases explicitly.
 */

export function testNativeMuxer_DeriveStssSampleNumbers_Simple() {

    console.log(
        "=== testNativeMuxer_DeriveStssSampleNumbers_Simple ==="
    );

    const samples = [
        { isKey: true  }, // 1
        { isKey: false }, // 2
        { isKey: false }, // 3
        { isKey: true  }, // 4
        { isKey: false }, // 5
        { isKey: true  }  // 6
    ];

    const syncSamples = deriveStssSampleNumbers({ samples });

    assertEqual("stss[0]", syncSamples[0], 1);
    assertEqual("stss[1]", syncSamples[1], 4);
    assertEqual("stss[2]", syncSamples[2], 6);
    assertEqual("stss.count", syncSamples.length, 3);

    console.log(
        "PASS: STSS derivation (sync sample numbers)"
    );
}

export function testNativeMuxer_DeriveStssSampleNumbers_NoKeyInfo() {
    console.log(
        "=== testNativeMuxer_DeriveStssSampleNumbers_NoKeyInfo ==="
    );

    const samples = [
        {}, // 1
        {}, // 2
        {}, // 3
        {}, // 4
    ];

    const syncSamples = deriveStssSampleNumbers({ samples });

    assertEqual(
        "stss.count (no isKey present)",
        syncSamples.length,
        0
    );

    console.log(
        "PASS: STSS derivation omitted when isKey is absent"
    );
}
