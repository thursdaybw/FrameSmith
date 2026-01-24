import { deriveSyncSampleNumbers } from "../derivers/deriveSyncSampleNumbers.js";
import { assertEqual } from "./assertions.js";

/**
 * Sync sample semantics derivation
 * ================================
 *
 * This test validates semantic knowledge about sync samples,
 * NOT container representation decisions.
 *
 * It does NOT assert whether an stss box is emitted.
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

export function testNativeMuxer_DeriveSyncSampleNumbers_Simple() {

    const samples = [
        { isKey: true  }, // 1
        { isKey: false }, // 2
        { isKey: false }, // 3
        { isKey: true  }, // 4
        { isKey: false }, // 5
        { isKey: true  }  // 6
    ];

    const result = deriveSyncSampleNumbers({ samples });

    assertEqual(
        "status",
        result.status,
        "present"
    );

    assertEqual("count", result.sampleNumbers.length, 3);
    assertEqual("sample[0]", result.sampleNumbers[0], 1);
    assertEqual("sample[1]", result.sampleNumbers[1], 4);
    assertEqual("sample[2]", result.sampleNumbers[2], 6);

}

export function testNativeMuxer_DeriveSyncSampleNumbers_NoKeyInfo() {

    const samples = [
        {}, // 1
        {}, // 2
        {}, // 3
        {}, // 4
    ];

    const result = deriveSyncSampleNumbers({ samples });

    assertEqual(
        "status",
        result.status,
        "not present"
    );

    assertEqual(
        "sampleNumbers",
        result.sampleNumbers,
        false
    );

}
