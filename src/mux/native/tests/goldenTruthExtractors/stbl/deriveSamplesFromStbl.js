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

import { getGoldenTruthBox } from "../index.js";

export function deriveSamplesFromStbl(stblBoxBytes) {
    assertStbl(stblBoxBytes);

    const tables     = readStblTables(stblBoxBytes);
    const samplePlan = buildSamplePlan(tables);
    const samples    =  assembleSamples(samplePlan, tables);
    assignPacketIndicesFromOffsets(samples);
    return samples; 
}


function readStblTables(stblBoxBytes) {
    return {
        sampleSizes: readSampleSizes(stblBoxBytes),
        timing: readSampleTiming(stblBoxBytes),
        offsets: readSampleOffsets(stblBoxBytes),
        syncSamples: readSyncSamples(stblBoxBytes),

        stscEntries: readStscEntries(stblBoxBytes),
        chunkOffsets: readChunkOffsets(stblBoxBytes)
    };
}

function readStscEntries(stblBoxBytes) {
    return getGoldenTruthBox
        .getSemanticBoxDataFromBox({
            boxBytes: stblBoxBytes,
            sourceRegistryKey: "moov/trak/mdia/minf/stbl",
            targetBoxPath: "moov/trak/mdia/minf/stbl/stsc"
        })
        .readBoxReport()
        .box.fields.entries;
}

function readChunkOffsets(stblBoxBytes) {
    return getGoldenTruthBox
        .getSemanticBoxDataFromBox({
            boxBytes: stblBoxBytes,
            sourceRegistryKey: "moov/trak/mdia/minf/stbl",
            targetBoxPath: "moov/trak/mdia/minf/stbl/stco"
        })
        .readBoxReport()
        .box.fields.chunkOffsets;
}

function buildSamplePlan({ sampleSizes }) {
    return {
        sampleCount: sampleSizes.length
    };
}

function assembleSamples(plan, tables) {
    const {
        sampleSizes,
        timing,
        offsets,
        syncSamples
    } = tables;

    const samples = [];

    for (let i = 0; i < plan.sampleCount; i++) {
        samples.push({
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

function assertStbl(stblBoxBytes) {
    if (!(stblBoxBytes instanceof Uint8Array)) {
        throw new Error(
            "deriveSamplesFromStbl: expected Uint8Array stbl box"
        );
    }
}

function buildSamplePlanFromChunks({ stscEntries, chunkOffsets }) {
    const runs = [];

    for (let i = 0; i < stscEntries.length; i++) {
        const entry = stscEntries[i];
        const next = stscEntries[i + 1];

        const firstChunk = entry.firstChunk - 1;
        const lastChunk =
            next
                ? next.firstChunk - 2
                : chunkOffsets.length - 1;

        for (let c = firstChunk; c <= lastChunk; c++) {
            runs.push({
                samplesPerChunk: entry.samplesPerChunk
            });
        }
    }

    return {
        kind: "packetized",
        packetRuns: runs
    };
}

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
                .getSemanticBoxDataFromBox({
                    boxBytes: stblBoxBytes,
                    sourceRegistryKey: "moov/trak/mdia/minf/stbl",
                    targetBoxPath: "moov/trak/mdia/minf/stbl/ctts"
                })
                .readBoxReport();

        const entries = ctts?.box?.fields?.entries;
        if (!Array.isArray(entries)) {
            throw new Error();
        }

        const offsets = [];
        for (const entry of entries) {
            const count = entry?.count;
            const offset = entry?.offset;
            if (!Number.isInteger(count) || count < 0 || !Number.isInteger(offset)) {
                throw new Error();
            }
            for (let i = 0; i < count; i++) {
                offsets.push(offset);
            }
        }

        return offsets;
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


    if ( !stco.box.fields || !Array.isArray(stco.box.fields.chunkOffsets)) {
        throw new Error( "stco.box.fields.chunkOffsets missing or invalid");
    }

    if ( !stsc.box.fields || !Array.isArray(stsc.box.fields.entries)) {
        throw new Error( "stsc.box.fields.entries missing or invalid");
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
            .getSemanticBoxDataFromBox({
                boxBytes: stblBoxBytes,
                sourceRegistryKey: "moov/trak/mdia/minf/stbl",
                targetBoxPath: "moov/trak/mdia/minf/stbl/stss"
            })
            .readBoxReport();

        const sampleNumbers =
            stss?.box?.fields?.sampleNumbers ??
            stss?.box?.samples;

        if (!Array.isArray(sampleNumbers)) {
            throw new Error();
        }

        // Convert 1-based sample numbers to 0-based indices
        return new Set(
            sampleNumbers.map(i => i - 1)
        );
    } catch {
        return null;
    }
}

/**
 * assignPacketIndicesFromOffsets
 * ==============================
 *
 * Works out which samples belong to the same packet by
 * looking at where their bytes sit in the MP4 file.
 *
 * Idea in plain terms:
 * - Samples are written into the file one after another.
 * - If one sample ends and the next one starts immediately
 *   after it, they belong to the same packet.
 * - If there is a gap or a jump, that means a new packet
 *   has started.
 *
 * How it works:
 * - The first sample always starts packet 0.
 * - For each next sample:
 *     - If its offset is exactly the end of the previous
 *       sample, it stays in the same packet.
 *     - Otherwise, the packet number is increased.
 * - The packet number is written onto each sample as
 *   `packetIndex`.
 *
 * Why this is correct:
 * - Packets are written to MDAT as one continuous block.
 * - MP4 never splits a packet in the middle.
 * - So byte continuity in MDAT is the only reliable way
 *   to discover packet boundaries.
 *
 * This does not guess:
 * - It does not look at codecs.
 * - It does not look at timing.
 * - It only uses real byte positions from the file.
 *
 * Input:
 * - samples: array of sample objects with `offset` and `size`
 *
 * Output:
 * - The same samples array, with `packetIndex` added
 *   to each sample.
 */
function assignPacketIndicesFromOffsets(samples) {
    let packetIndex = 0;

    samples[0].packetIndex = 0;

    for (let i = 1; i < samples.length; i++) {
        const prev = samples[i - 1];
        const curr = samples[i];

        const prevEnd = prev.offset + prev.size;

        if (curr.offset !== prevEnd) {
            // gap → new packet
            packetIndex++;
        }

        curr.packetIndex = packetIndex;
    }

    return samples;
}
