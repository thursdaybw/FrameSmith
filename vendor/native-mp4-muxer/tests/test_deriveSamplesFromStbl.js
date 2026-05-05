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

    const resp = await fetch("reference/reference_av.mp4");
    const mp4 = new Uint8Array(await resp.arrayBuffer());

    // Resolve a concrete STBL box (video track)
    const stbl = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(mp4, "moov/trak[0]/mdia/minf/stbl").readBoxReport();

    assertExists("stbl.readBoxReport()", stbl);
    assertExists("stbl.raw", stbl.raw);

    // ---------------------------------------------------------
    // Invoke derivation
    // ---------------------------------------------------------

    const samples = deriveSamplesFromStbl(stbl.raw);

    // ---------------------------------------------------------
    // TOP-LEVEL SHAPE
    // ---------------------------------------------------------

    assertEqual( "samples is array", Array.isArray(samples), true);
    assertEqual( "at least one sample present", samples.length > 0, true);

    // ---------------------------------------------------------
    // PER-SAMPLE SHAPE (contract)
    // ---------------------------------------------------------

    const first = samples[0];

    assertExists("sample.dts", first.dts);
    assertExists("sample.pts", first.pts);
    assertExists("sample.duration", first.duration);
    assertExists("sample.size", first.size);
    assertExists("sample.offset", first.offset);
    assertExists("sample.isSync", first.isSync);

    // ---------------------------------------------------------
    // INVARIANTS
    // ---------------------------------------------------------

    assertEqual( "sample.size is integer", Number.isInteger(first.size), true);
    assertEqual( "sample.offset is integer", Number.isInteger(first.offset), true);
    assertEqual( "sample.isSync is boolean", typeof first.isSync === "boolean", true);
}

export async function test_DeriveSamplesFromStbl_SyncParityWithStss() {

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4 = new Uint8Array(await resp.arrayBuffer());

    const stblReport =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4,
                "moov/trak[0]/mdia/minf/stbl"
            )
            .readBoxReport();

    const stssReport =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4,
                "moov/trak[0]/mdia/minf/stbl/stss"
            )
            .readBoxReport();

    assertExists("stblReport", stblReport);
    assertExists("stssReport", stssReport);

    const derivedSamples = deriveSamplesFromStbl(stblReport.raw);
    const sampleNumbers = stssReport?.box?.fields?.sampleNumbers;

    assertEqual(
        "stss.sampleNumbers is array",
        Array.isArray(sampleNumbers),
        true
    );

    const expectedSyncIndices = new Set(
        sampleNumbers.map((sampleNumber) => sampleNumber - 1)
    );

    const derivedSyncCount =
        derivedSamples.filter((sample) => sample.isSync === true).length;

    assertEqual(
        "derived sync count must match stss entry count",
        derivedSyncCount,
        expectedSyncIndices.size
    );

    for (let i = 0; i < derivedSamples.length; i++) {
        assertEqual(
            `sample[${i}] sync parity`,
            derivedSamples[i].isSync,
            expectedSyncIndices.has(i)
        );
    }
}

export async function test_DeriveSamplesFromStbl_AppliesCttsOffsets() {
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4 = new Uint8Array(await resp.arrayBuffer());

    const stblReport =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4,
                "moov/trak[0]/mdia/minf/stbl"
            )
            .readBoxReport();

    const cttsReport =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4,
                "moov/trak[0]/mdia/minf/stbl/ctts"
            )
            .readBoxReport();

    const derivedSamples = deriveSamplesFromStbl(stblReport.raw);
    const cttsEntries = cttsReport?.box?.fields?.entries;

    assertEqual("ctts entries available", Array.isArray(cttsEntries), true);

    const expandedOffsets = [];
    for (const entry of cttsEntries) {
        for (let i = 0; i < entry.count; i++) {
            expandedOffsets.push(entry.offset);
        }
    }

    assertEqual(
        "expanded ctts length must match sample count",
        expandedOffsets.length,
        derivedSamples.length
    );

    let nonZeroOffsetSamples = 0;
    for (let i = 0; i < derivedSamples.length; i++) {
        const expectedPts = derivedSamples[i].dts + expandedOffsets[i];
        assertEqual(
            `sample[${i}] pts must equal dts + ctts offset`,
            derivedSamples[i].pts,
            expectedPts
        );
        if (expandedOffsets[i] !== 0) {
            nonZeroOffsetSamples++;
        }
    }

    assertEqual(
        "ctts fixture must include at least one non-zero offset",
        nonZeroOffsetSamples > 0,
        true
    );
}
