/** deriveSamplesFromStbl
 * =====================
 *
 * Derives per-sample container truth from an stbl box.
 *
 * This function:
 * - is pure
 * - is track-scoped
 * - is codec-agnostic
 * - derives facts only from ISO BMFF container boxes
 *
 * It does NOT:
 * - interpret codec bitstreams
 * - construct access units
 * - apply policy or heuristics
 */

import { getGoldenTruthBox }
    from "../index.js";

export function deriveSamplesFromStbl(stblBoxBytes) {
    if (!(stblBoxBytes instanceof Uint8Array)) {
        throw new Error(
            "deriveSamplesFromStbl: expected Uint8Array stbl box"
        );
    }

    // ---------------------------------------------------------
    // Read required tables (FACTS ONLY)
    // ---------------------------------------------------------

    const sampleSizes = readSampleSizes(stblBoxBytes);
    const timing      = readSampleTiming(stblBoxBytes);
    const offsets     = readSampleOffsets(stblBoxBytes);
    const syncSamples = readSyncSamples(stblBoxBytes);

    // ---------------------------------------------------------
    // Assemble samples (index-aligned)
    // ---------------------------------------------------------

    const sampleCount = sampleSizes.length;
    const samples = [];

    for (let i = 0; i < sampleCount; i++) {
        samples.push({
            index: i,

            dts: timing.dts[i],
            pts: timing.pts[i],
            duration: timing.duration[i],

            size: sampleSizes[i],
            offset: offsets[i],

            isSync:
                syncSamples
                    ? syncSamples.has(i)
                    : true
        });
    }

    return samples;
}

// ---------------------------------------------------------------------------
// Helpers — ALL use readBoxReport().box only
// ---------------------------------------------------------------------------

function readSampleSizes(stblBoxBytes) {

    const stsz = getGoldenTruthBox.getSemanticBoxDataFromBox(
            {
                boxBytes: stblBoxBytes,
                sourceRegistryKey: "moov/trak/mdia/minf/stbl",
                targetBoxPath: "moov/trak/mdia/minf/stbl/stsz"
            }
        )
        .readBoxReport();

    if (
        !stsz.box.fields ||
        !Array.isArray(stsz.box.fields.sizes)
    ) {
        throw new Error(
            "stsz.box.fields.sizes missing or invalid"
        );
    }

    return stsz.box.fields.sizes.slice();
}

function tryGetCtts(stblBoxBytes) {
    try {
        const ctts =
            getGoldenTruthBox
                .getSemanticBoxDataByPathFromIsoBox(stblBoxBytes, "ctts")
                .readBoxReport();

        if (!Array.isArray(ctts.box.offsets)) {
            throw new Error();
        }

        return ctts.box.offsets.slice();
    } catch {
        return null;
    }
}

function readSampleTiming(stblBoxBytes) {

    const stts = getGoldenTruthBox.getSemanticBoxDataFromBox(
        {
            boxBytes: stblBoxBytes,
            sourceRegistryKey: "moov/trak/mdia/minf/stbl",
            targetBoxPath: "moov/trak/mdia/minf/stbl/stts"
        }
    )
    .readBoxReport();

    if (
        !stts.box ||
        !stts.box.fields ||
        !Array.isArray(stts.box.fields.entries)
    ) {
        throw new Error(
            "stts.box.fields.entries missing or invalid"
        );
    }

    const entries = stts.box.fields.entries;

    const cttsOffsets =
        tryGetCtts(stblBoxBytes);

    const dts = [];
    const pts = [];
    const duration = [];

    let currentDts = 0;
    let sampleIndex = 0;

    for (const entry of entries) {

        for (let i = 0; i < entry.sampleCount; i++) {

            dts[sampleIndex] = currentDts;
            duration[sampleIndex] = entry.sampleDelta;

            const offset =
                cttsOffsets
                ? cttsOffsets[sampleIndex]
                : 0;

            pts[sampleIndex] =
                currentDts + offset;

            currentDts += entry.sampleDelta;
            sampleIndex++;
        }
    }

    return { dts, pts, duration };
}

function readSampleOffsets(stblBoxBytes) {


    const stsc = getGoldenTruthBox.getSemanticBoxDataFromBox({
        boxBytes: stblBoxBytes,
        sourceRegistryKey: "moov/trak/mdia/minf/stbl",
        targetBoxPath: "moov/trak/mdia/minf/stbl/stsc"
    }).readBoxReport();

    const stco = getGoldenTruthBox.getSemanticBoxDataFromBox({
        boxBytes: stblBoxBytes,
        sourceRegistryKey: "moov/trak/mdia/minf/stbl",
        targetBoxPath: "moov/trak/mdia/minf/stbl/stco"
    }).readBoxReport();

    const stsz = getGoldenTruthBox.getSemanticBoxDataFromBox({
        boxBytes: stblBoxBytes,
        sourceRegistryKey: "moov/trak/mdia/minf/stbl",
        targetBoxPath: "moov/trak/mdia/minf/stbl/stsz"
    }).readBoxReport();


    if (
        !stco.box.fields ||
        !Array.isArray(stco.box.fields.chunkOffsets)
    ) {
        throw new Error(
            "stco.box.fields.chunkOffsets missing or invalid"
        );
    }

    if (
        !stsc.box.fields ||
        !Array.isArray(stsc.box.fields.entries)
    ) {
        throw new Error(
            "stsc.box.fields.entries missing or invalid"
        );
    }

    const chunkOffsets = stco.box.fields.chunkOffsets;
    const sampleSizes  = stsz.box.fields.sizes;
    const stscEntries  = stsc.box.fields.entries;

    // ---------------------------------------------------------
    // Build chunk → samplesPerChunk plan
    // ---------------------------------------------------------

    const chunkCount = chunkOffsets.length;
    const samplesPerChunk = new Array(chunkCount);

    for (let i = 0; i < stscEntries.length; i++) {

        const entry = stscEntries[i];

        const startChunk =
            entry.firstChunk - 1;

        const endChunk =
            (i + 1 < stscEntries.length)
            ? stscEntries[i + 1].firstChunk - 2
            : chunkCount - 1;

        for (let c = startChunk; c <= endChunk; c++) {
            samplesPerChunk[c] =
                entry.samplesPerChunk;
        }
    }

    // ---------------------------------------------------------
    // Walk chunks and assign sample offsets
    // ---------------------------------------------------------

    const offsets = [];
    let sampleIndex = 0;

    for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {

        const chunkStart =
            chunkOffsets[chunkIndex];

        const samplesInChunk =
            samplesPerChunk[chunkIndex];

        if (!Number.isInteger(samplesInChunk)) {
            throw new Error(
                `Missing samplesPerChunk for chunk ${chunkIndex}`
            );
        }

        let offsetInChunk = 0;

        for (let i = 0; i < samplesInChunk; i++) {

            offsets[sampleIndex] =
                chunkStart + offsetInChunk;

            offsetInChunk +=
                sampleSizes[sampleIndex];

            sampleIndex++;
        }
    }

    return offsets;
}

function readSyncSamples(stblBoxBytes) {
    try {
        const stss =
            getGoldenTruthBox
            .getSemanticBoxDataByPathFromIsoBox(stblBoxBytes, "stss")
            .readBoxReport();

        if (!Array.isArray(stss.box.samples)) {
            throw new Error();
        }

        // Convert 1-based sample numbers to 0-based indices
        return new Set(
            stss.box.samples.map(i => i - 1)
        );
    } catch {
        return null;
    }
}
