/**
 * STBL → Derived Samples Definition Test
 *
 * This test defines the executable contract for
 * deriveSamplesFromStbl().
 *
 * It asserts:
 * - shape
 * - ordering
 * - invariants
 *
 * It does NOT assert:
 * - exact timestamps
 * - exact offsets
 * - codec behavior
 */

import {
    assertExists,
    assertEqual
} from "./assertions.js";

import { getGoldenTruthBox }
    from "./goldenTruthExtractors/index.js";

import { deriveSamplesFromStbl }
    from "./goldenTruthExtractors/stbl/deriveSamplesFromStbl.js";

export async function test_DeriveSamplesFromStbl_Definition() {

    const resp =
        await fetch("reference/reference_av.mp4");

    const mp4 =
        new Uint8Array(await resp.arrayBuffer());

    // Resolve a concrete STBL box (video track)
    const stbl =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4,
                "moov/trak[0]/mdia/minf/stbl"
            )
            .readBoxReport();

    assertExists("stbl.readBoxReport()", stbl);
    assertExists("stbl.raw", stbl.raw);

    // ---------------------------------------------------------
    // Invoke derivation
    // ---------------------------------------------------------

    const samples =
        deriveSamplesFromStbl(stbl.raw);

    // ---------------------------------------------------------
    // TOP-LEVEL SHAPE
    // ---------------------------------------------------------

    assertEqual(
        "samples is array",
        Array.isArray(samples),
        true
    );

    assertEqual(
        "at least one sample present",
        samples.length > 0,
        true
    );

    // ---------------------------------------------------------
    // PER-SAMPLE SHAPE (contract)
    // ---------------------------------------------------------

    const first = samples[0];

    assertExists("sample.index", first.index);
    assertExists("sample.dts", first.dts);
    assertExists("sample.pts", first.pts);
    assertExists("sample.duration", first.duration);
    assertExists("sample.size", first.size);
    assertExists("sample.offset", first.offset);
    assertExists("sample.isSync", first.isSync);

    // ---------------------------------------------------------
    // INVARIANTS
    // ---------------------------------------------------------

    assertEqual(
        "sample.index is integer",
        Number.isInteger(first.index),
        true
    );

    assertEqual(
        "sample.size is integer",
        Number.isInteger(first.size),
        true
    );

    assertEqual(
        "sample.offset is integer",
        Number.isInteger(first.offset),
        true
    );

    assertEqual(
        "sample.isSync is boolean",
        typeof first.isSync === "boolean",
        true
    );

    // Ordering invariant
    assertEqual(
        "samples are index-ordered",
        samples.every((s, i) => s.index === i),
        true
    );
}
