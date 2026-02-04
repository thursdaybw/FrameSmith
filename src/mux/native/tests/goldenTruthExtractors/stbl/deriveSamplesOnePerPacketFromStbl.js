/**
 * deriveSamplesOnePerPacketFromStbl
 * =================================
 *
 * Derives packet-aligned access units from an stbl box.
 *
 * This function:
 * - is pure
 * - is track-scoped
 * - is codec-agnostic
 * - derives packet topology strictly from container tables
 *
 * It groups samples into packets using:
 *   - stsc (samples per chunk)
 *   - stco (chunk offsets)
 *   - stsz (sample sizes)
 *   - stts / ctts (timing)
 *
 * One returned access unit == one packet (chunk).
 */

import { getGoldenTruthBox } from "../index.js";
import { deriveSamplesFromStbl } from "./deriveSamplesFromStbl.js";

export function deriveSamplesOnePerPacketFromStbl(stblBoxBytes) {

    if (!(stblBoxBytes instanceof Uint8Array)) {
        throw new Error(
            "deriveSamplesOnePerPacketFromStbl: expected Uint8Array stbl box"
        );
    }

    // ---------------------------------------------------------
    // First derive canonical per-sample truth
    // ---------------------------------------------------------
    const samples = deriveSamplesFromStbl(stblBoxBytes);

    if (!Array.isArray(samples) || samples.length === 0) {
        return [];
    }

    // ---------------------------------------------------------
    // Read stsc (packetization plan)
    // ---------------------------------------------------------
    const stsc = getGoldenTruthBox
        .getSemanticBoxDataFromBox({
            boxBytes: stblBoxBytes,
            sourceRegistryKey: "moov/trak/mdia/minf/stbl",
            targetBoxPath: "moov/trak/mdia/minf/stbl/stsc"
        })
        .readBoxReport();

    if (
        !stsc.box ||
        !stsc.box.fields ||
        !Array.isArray(stsc.box.fields.entries)
    ) {
        throw new Error(
            "deriveSamplesOnePerPacketFromStbl: stsc.entries missing or invalid"
        );
    }

    const stscEntries = stsc.box.fields.entries;

    // ---------------------------------------------------------
    // Build chunk → samplesPerChunk table
    // ---------------------------------------------------------
    const chunkCount =
        getGoldenTruthBox
            .getSemanticBoxDataFromBox({
                boxBytes: stblBoxBytes,
                sourceRegistryKey: "moov/trak/mdia/minf/stbl",
                targetBoxPath: "moov/trak/mdia/minf/stbl/stco"
            })
            .readBoxReport()
            .box
            .fields
            .chunkOffsets
            .length;

    const samplesPerChunk = new Array(chunkCount);

    for (let i = 0; i < stscEntries.length; i++) {

        const entry = stscEntries[i];
        const nextEntry = stscEntries[i + 1];

        const startChunk = entry.firstChunk - 1;
        const endChunk =
            nextEntry
                ? nextEntry.firstChunk - 2
                : chunkCount - 1;

        for (let c = startChunk; c <= endChunk; c++) {
            samplesPerChunk[c] = entry.samplesPerChunk;
        }
    }

    // ---------------------------------------------------------
    // Collapse samples into packet-level access units
    // ---------------------------------------------------------
    const packets = [];

    let sampleCursor = 0;

    for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {

        const count = samplesPerChunk[chunkIndex];

        if (!Number.isInteger(count) || count <= 0) {
            throw new Error(
                `deriveSamplesOnePerPacketFromStbl: invalid samplesPerChunk for chunk ${chunkIndex}`
            );
        }

        const firstSample = samples[sampleCursor];
        const lastSample =
            samples[sampleCursor + count - 1];

        let totalSize = 0;
        let duration = 0;
        let isKey = true;

        for (let i = 0; i < count; i++) {
            const s = samples[sampleCursor + i];
            totalSize += s.size;
            duration += s.duration;
            if (!s.isSync) {
                isKey = false;
            }
        }

        packets.push({
            pts: firstSample.pts,
            dts: firstSample.dts,
            duration,
            size: totalSize,
            offset: firstSample.offset,
            isKey,
            packetIndex: packets.length
        });

        sampleCursor += count;
    }

    if (sampleCursor !== samples.length) {
        throw new Error(
            "deriveSamplesOnePerPacketFromStbl: packetization did not consume all samples"
        );
    }

    return packets;
}
