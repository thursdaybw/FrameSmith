import { runGoldenMp4AVTestClient } from "./clients/goldenMp4AVSourceClient.js";
import { prepareTracksForStructuralDerivation } from "../compiler/compileMp4.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import {
    assertExists,
    assertEqual,
    assertEqualHex,
    assertEqualHexCollect,
    assertArrayEqual,
} from "./assertions.js";
import { deriveStructuralStateInPlace } from "../derivers/deriveStructuralStateInPlace.js";
import { buildMdatPayloadAndChunkLayout } from "../mdat/buildMdatPayloadAndChunkLayout.js";
import { decodeBasicBoxHeader } from "../box-schema/boxLayoutReaders.js";
import { GoldenTruthRegistry } from "./goldenTruthExtractors/GoldenTruthRegistry.js";
import { gatherTrackMdatFactsFromChunks } from "../mdat/gatherTrackMdatFactsFromChunks.js";
import { ChunkingStrategies } from "../derivers/strategies/chunkingStrategies.js";
import { PacketizationStrategies } from "../derivers/strategies/packetizationStrategies.js"
import { deriveStszIntentFromPayloads }  from "../derivers/deriveStszIntentFromPayloads.js";

import { getSamplesChunkedInFfmpegOpusFormat } from "../derivers/strategies/getSamplesChunkedInFfmpegOpusFormat.js";

export async function testNativeMuxer_MDAT_Box_Equals_FFmpegOracle() {

    const fixtures = [
        "reference/reference_av_opus.mp4",
        "reference/reference_av.mp4", // mp4a + avc1
    ];

    for (const fixture of fixtures) {

        // ---------------------------------------------------------
        // Load oracle MP4
        // ---------------------------------------------------------
        const resp = await fetch(fixture);
        const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

        //console.log("fixture: ", fixture);
        //logOracleGlobalChunkLayout({ mp4Bytes, maxChunks: 20 });

        // ---------------------------------------------------------
        // Run golden client
        // ---------------------------------------------------------
        const mp4CompilerState = await runGoldenMp4AVTestClient({ mp4Bytes });

        // ---------------------------------------------------------
        // Compiler tiers up to MDAT payload
        // ---------------------------------------------------------
        prepareTracksForStructuralDerivation({ mp4CompilerState });

        for (const track of mp4CompilerState.tracks) {
            deriveStructuralStateInPlace({ track });
        }

        mp4CompilerState.mdatPayloadAndChunkLayout = buildMdatPayloadAndChunkLayout({ mp4CompilerState });

        // ---------------------------------------------------------
        // Emit compiler MDAT box
        // ---------------------------------------------------------
        const compilerMdatBytes = serializeBoxTree(EmitterRegistry.emit("mdat", { payload: mp4CompilerState.mdatPayloadAndChunkLayout.mdatPayload}));

        // ---------------------------------------------------------
        // Extract oracle MDAT box (full box bytes)
        // ---------------------------------------------------------
        const oracleMdatReport = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(mp4Bytes, "mdat").readBoxReport();
        const oracleMdatBytes = oracleMdatReport.raw;

        // ---------------------------------------------------------
        // Byte-for-byte comparison
        // ---------------------------------------------------------
        const diffs = [];
        const byteCount = Math.max(compilerMdatBytes.length, oracleMdatBytes.length);

        for (let i = 0; i < byteCount; i++) {
            assertEqualHexCollect(diffs, `${fixture}: mdat.byte[${i}]`, compilerMdatBytes[i], oracleMdatBytes[i]);
        }
 
        if (diffs.length) {
            console.table(diffs.slice(0, 50));
            throw new Error(
                `${fixture}: MDAT box mismatch (${diffs.length} bytes differ)`
            );
        }

        // ---------------------------------------------------------
        // MDAT layout sanity checks
        // ---------------------------------------------------------

        assertExists("mdatChunkLayout exists", mp4CompilerState.mdatPayloadAndChunkLayout.mdatChunkLayout);
        assertEqual("mdatChunkLayout is non-empty", mp4CompilerState.mdatPayloadAndChunkLayout.mdatChunkLayout.length > 0, true);

        let cursor = 0;

        for (let i = 0; i < mp4CompilerState.mdatPayloadAndChunkLayout.mdatChunkLayout.length; i++) {
            const chunk = mp4CompilerState.mdatPayloadAndChunkLayout.mdatChunkLayout[i];

            assertEqual("chunkIndex", chunk.chunkIndex, i);

            assertEqual( "chunk.offsetWithinMdat is contiguous", chunk.offsetWithinMdat, cursor);

            assertEqual( "chunk.byteLength matches bytes length", chunk.byteLength, chunk.bytes.length);

            assertExists("chunk.trackIndex exists", chunk.trackIndex);

            assertEqual( "chunk.trackIndex is within track bounds", chunk.trackIndex >= 0 && chunk.trackIndex < mp4CompilerState.tracks.length, true);

            cursor += chunk.byteLength;
        }

        assertEqual( "MDAT payload length equals sum of chunk byte lengths", cursor, mp4CompilerState.mdatPayloadAndChunkLayout.mdatPayload.length);

    }
}


function logOracleChunkLayout({ mp4Bytes, trackIndex, maxChunks = 20, label = "" }) {

    const stco = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4Bytes,
        `moov/trak[${trackIndex}]/mdia/minf/stbl/stco`
    )
        .readBoxReport().box.fields;

    const stsz = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4Bytes,
        `moov/trak[${trackIndex}]/mdia/minf/stbl/stsz`
    ).readBoxReport().box.fields;

    const stsc = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4Bytes,
        `moov/trak[${trackIndex}]/mdia/minf/stbl/stsc`
    ).readBoxReport().box.fields;

    // ---------------------------------------------------------
    // Build samples-per-chunk lookup
    // ---------------------------------------------------------
    const samplesPerChunkByIndex = [];

    for (let i = 0; i < stsc.entries.length; i++) {
        const entry = stsc.entries[i];
        const first = entry.firstChunk - 1;
        const last =
            i + 1 < stsc.entries.length
            ? stsc.entries[i + 1].firstChunk - 2
            : stco.chunkOffsets.length - 1;

        for (let c = first; c <= last; c++) {
            samplesPerChunkByIndex[c] = entry.samplesPerChunk;
        }
    }

    // ---------------------------------------------------------
    // Build flat chunk rows
    // ---------------------------------------------------------
    const rows = [];

    let sampleCursor = 0;

    for (let chunkIndex = 0; chunkIndex < stco.chunkOffsets.length; chunkIndex++) {
        const fileOffset = stco.chunkOffsets[chunkIndex];
        const samplesPerChunk = samplesPerChunkByIndex[chunkIndex];

        let byteLength = 0;
        const sampleIndices = [];

        for (let i = 0; i < samplesPerChunk; i++) {
            byteLength += stsz.sizes[sampleCursor];
            sampleIndices.push(sampleCursor);
            sampleCursor++;
        }

        rows.push({
            track: trackIndex,
            chunk: chunkIndex,
            fileOffset,
            samplesPerChunk,
            firstSample: sampleIndices[0],
            lastSample: sampleIndices[sampleIndices.length - 1],
            byteLength,
            fileRangeStart: fileOffset,
            fileRangeEnd: fileOffset + byteLength
        });
    }

    console.log( `\nORACLE CHUNK LAYOUT ${label ? `(${label})` : ""} — track ${trackIndex}`);
    console.table(rows.slice(0, maxChunks));

    return rows;
}

export function logOracleGlobalChunkLayout({ mp4Bytes, maxChunks = 40 }) {
    const allChunks = [];

    //const trakCount = getGoldenTruthBox .getSemanticBoxDataByPathFromMp4File(mp4Bytes, "moov").readBoxReport().box.fields.trakCount;
    const trakCount = 2 

    for (let trackIndex = 0; trackIndex < trakCount; trackIndex++) {

        const { stco, stsc, stsz } =
            extractOracleTrackTables({ mp4Bytes, trackIndex });

        // Build samplesPerChunk lookup
        const samplesPerChunkByIndex = [];

        for (let i = 0; i < stsc.entries.length; i++) {
            const entry = stsc.entries[i];
            const first = entry.firstChunk - 1;
            const last =
                i + 1 < stsc.entries.length
                ? stsc.entries[i + 1].firstChunk - 2
                : stco.chunkOffsets.length - 1;

            for (let c = first; c <= last; c++) {
                samplesPerChunkByIndex[c] = entry.samplesPerChunk;
            }
        }

        let sampleCursor = 0;

        for (let chunkIndex = 0; chunkIndex < stco.chunkOffsets.length; chunkIndex++) {

            const samplesInChunk = samplesPerChunkByIndex[chunkIndex];
            let byteLength = 0;

            for (let i = 0; i < samplesInChunk; i++) {
                byteLength += stsz.sizes[sampleCursor++];
            }

            allChunks.push({
                trackIndex,
                chunkIndex,
                fileOffset: stco.chunkOffsets[chunkIndex],
                samplesPerChunk: samplesInChunk,
                byteLength,
                fileRange:
                `0x${stco.chunkOffsets[chunkIndex].toString(16)} .. ` +
                `0x${(stco.chunkOffsets[chunkIndex] + byteLength).toString(16)}`
            });
        }
    }

    allChunks.sort((a, b) => a.fileOffset - b.fileOffset);

    console.table(allChunks.slice(0, maxChunks));
}

export async function testNativeMuxer_OPUS_STSC_MDAT_CompilerPath_with_FFmpegOpus_ChunkGroupPolicy_Equals_FFmpegOracle() {

    const resp = await fetch("reference/reference_av_opus.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    const mp4CompilerState = await runGoldenMp4AVTestClient({ mp4Bytes });

    assertOracleOpusChunkPatternIsFFmpegStyle({ trackIndex: 1, mp4Bytes });

    // Compiler tier 1
    prepareTracksForStructuralDerivation({ mp4CompilerState });

    for (const track of mp4CompilerState.tracks) {
        deriveStructuralStateInPlace({ track });
    }

    // ---------------------------------------------------------
    // LOCATE AUDIO TRACK (COMPILER)
    // ---------------------------------------------------------

    const audioTrack = mp4CompilerState.tracks[1];

    const oracleStscEntries = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4Bytes, `moov/trak[1]/mdia/minf/stbl/stsc`
    ).readBoxReport().box.fields.entries;

    const oracleChunkOffsets = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4Bytes, `moov/trak[1]/mdia/minf/stbl/stco`
    ).readBoxReport().box.fields.chunkOffsets;

    assertChunkTopologyMatchesOracle({ derivedChunks: mp4CompilerState.tracks[1].chunks, oracleStscEntries, oracleChunkOffsets });

    // ---------------------------------------------------------
    // BUILD COMPILER AUDIO MDAT BYTES (TRACK-LOCAL)
    // ---------------------------------------------------------
    const zeroLengthPayloads = mp4CompilerState.tracks[1].payloads.accessUnitPayloads
        .map((p, index) => ({ index, size: p.byteLength }))
        .filter(p => p.size === 0);

    const compilerAudioFacts = gatherTrackMdatFactsFromChunks({
        accessUnitGroups: mp4CompilerState.tracks[1].chunks,
        accessUnitPayloads: mp4CompilerState.tracks[1].payloads.accessUnitPayloads
    });

    const producedAudioBytes = normalizeTrackMdatFactsForTests(compilerAudioFacts);

    // ---------------------------------------------------------
    // EXTRACT ORACLE MDAT + AUDIO STCO/STSZ
    // ---------------------------------------------------------
    const oracleMdatReport = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4Bytes,
        "mdat"
    ).readBoxReport();

    const oracleMdatPayload = oracleMdatReport.raw.slice(8);

    const oracleMdatPayloadFileOffset = oracleMdatReport.offset + 8;

    const oracleStco =
        getGoldenTruthBox
        .getSemanticBoxDataByPathFromMp4File(
            mp4Bytes,
            `moov/trak[1]/mdia/minf/stbl/stco`
        )
        .getEmitterInput();

    const oracleStsz =
        getGoldenTruthBox
        .getSemanticBoxDataByPathFromMp4File(
            mp4Bytes,
            `moov/trak[1]/mdia/minf/stbl/stsz`
        )
        .getEmitterInput();

    // ---------------------------------------------------------
    // BUILD ORACLE AUDIO MDAT BYTES (CHUNK BY CHUNK)
    // ---------------------------------------------------------

    const oracleAudioBytes = extractOracleTrackMdatBytes({ mp4Bytes, trackIndex: 1 });

    // ---------------------------------------------------------
    // BYTE-FOR-BYTE DIAGNOSTIC (AUDIO ONLY)
    // ---------------------------------------------------------

    const diffs = [];

    const byteCount =
        Math.max(
            producedAudioBytes.length,
            oracleAudioBytes.length
        );

    for (let i = 0; i < byteCount; i++) {
        assertEqualHexCollect(
            diffs,
            `audio.mdat.byte[${i}]`,
            producedAudioBytes[i],
            oracleAudioBytes[i]
        );
    }

    if (diffs.length) {
        console.table(diffs.slice(0, 50));
        throw new Error(
            `audio mdat mismatch: ${diffs.length} bytes differ`
        );
    }
}

export async function testNativeMuxer_MP4A_STSC_MDAT_CompilerPath_Equals_FFmpegOracle() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    const mp4CompilerState = await runGoldenMp4AVTestClient({ mp4Bytes });

    // ---------------------------------------------------------
    // Compiler tier 1
    // ---------------------------------------------------------
    prepareTracksForStructuralDerivation({ mp4CompilerState });
    for (const track of mp4CompilerState.tracks) {
        deriveStructuralStateInPlace({ track });
    }

    // ---------------------------------------------------------
    // LOCATE AUDIO TRACK (MP4A)
    // ---------------------------------------------------------

    const audioTrackIndex =
        mp4CompilerState.tracks.findIndex(
            t => t.semanticTrackFamily === "audio"
        );

    if (audioTrackIndex === -1) {
        throw new Error("No audio track found");
    }

    const audioTrack = mp4CompilerState.tracks[audioTrackIndex];

    // ---------------------------------------------------------
    // ORACLE STSC / STCO
    // ---------------------------------------------------------

    const oracleStscEntries =
        getGoldenTruthBox
        .getSemanticBoxDataByPathFromMp4File(
            mp4Bytes,
            `moov/trak[${audioTrackIndex}]/mdia/minf/stbl/stsc`
        )
        .readBoxReport()
        .box
        .fields
        .entries;

    const oracleChunkOffsets =
        getGoldenTruthBox
        .getSemanticBoxDataByPathFromMp4File(
            mp4Bytes,
            `moov/trak[${audioTrackIndex}]/mdia/minf/stbl/stco`
        )
        .readBoxReport()
        .box
        .fields
        .chunkOffsets;

    assertChunkTopologyMatchesOracle({
        derivedChunks: audioTrack.chunks,
        oracleStscEntries,
        oracleChunkOffsets
    });

    // ---------------------------------------------------------
    // BUILD COMPILER AUDIO MDAT BYTES (TRACK-LOCAL)
    // ---------------------------------------------------------

    const compilerAudioFacts = gatherTrackMdatFactsFromChunks({
        accessUnitGroups: audioTrack.chunks,
        accessUnitPayloads: audioTrack.payloads.accessUnitPayloads
    });

    const producedAudioBytes = normalizeTrackMdatFactsForTests(compilerAudioFacts);

    // ---------------------------------------------------------
    // BUILD ORACLE AUDIO MDAT BYTES
    // ---------------------------------------------------------

    const oracleAudioBytes =
        extractOracleTrackMdatBytes({
            mp4Bytes,
            trackIndex: audioTrackIndex
        });

    // ---------------------------------------------------------
    // BYTE-FOR-BYTE DIAGNOSTIC (AUDIO ONLY)
    // ---------------------------------------------------------

    const diffs = [];
    const byteCount = Math.max(producedAudioBytes.length, oracleAudioBytes.length);

    for (let i = 0; i < byteCount; i++) {
        assertEqualHexCollect(
            diffs,
            `mp4a.audio.mdat.byte[${i}]`,
            producedAudioBytes[i],
            oracleAudioBytes[i]
        );
    }

    if (diffs.length) {
        console.table(diffs.slice(0, 50));
        throw new Error(
            `mp4a audio mdat mismatch: ${diffs.length} bytes differ`
        );
    }
}

export async function testNativeMuxer_AVC1_STSC_MDAT_CompilerPath_Equals_FFmpegOracle() {

    const fixtures = [
        "reference/reference_av.mp4",
        "reference/reference_av_opus.mp4"
    ];

    for (const fixture of fixtures) {

        const resp = await fetch(fixture);
        const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

        const mp4CompilerState = await runGoldenMp4AVTestClient({ mp4Bytes });

        // Tier 1
        prepareTracksForStructuralDerivation({ mp4CompilerState });
        for (const track of mp4CompilerState.tracks) {
            deriveStructuralStateInPlace({ track });
        }

        // ---------------------------------------------------------
        // LOCATE VIDEO TRACK (AVC1)
        // ---------------------------------------------------------

        const videoTrackIndex =
            mp4CompilerState.tracks.findIndex(
                t => t.semanticTrackFamily === "video"
            );

        if (videoTrackIndex === -1) {
            throw new Error(`No video track found in ${fixture}`);
        }

        const videoTrack = mp4CompilerState.tracks[videoTrackIndex];

        const oracleStscEntries =
            getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4Bytes,
                `moov/trak[${videoTrackIndex}]/mdia/minf/stbl/stsc`
            )
            .readBoxReport()
            .box
            .fields
            .entries;

        const oracleChunkOffsets =
            getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4Bytes,
                `moov/trak[${videoTrackIndex}]/mdia/minf/stbl/stco`
            )
            .readBoxReport()
            .box
            .fields
            .chunkOffsets;

        assertChunkTopologyMatchesOracle({
            derivedChunks: videoTrack.chunks,
            oracleStscEntries,
            oracleChunkOffsets
        });

        // ---------------------------------------------------------
        // BUILD COMPILER VIDEO MDAT BYTES (TRACK-LOCAL)
        // ---------------------------------------------------------

        const compilerVideoFacts = gatherTrackMdatFactsFromChunks({
            accessUnitGroups: videoTrack.chunks,
            accessUnitPayloads: videoTrack.payloads.accessUnitPayloads
        });

        const producedVideoBytes = normalizeTrackMdatFactsForTests(compilerVideoFacts);

        // ---------------------------------------------------------
        // BUILD ORACLE VIDEO MDAT BYTES
        // ---------------------------------------------------------

        const oracleVideoBytes =
            extractOracleTrackMdatBytes({
                mp4Bytes,
                trackIndex: videoTrackIndex
            });

        // ---------------------------------------------------------
        // BYTE-FOR-BYTE DIAGNOSTIC (VIDEO ONLY)
        // ---------------------------------------------------------

        const diffs = [];
        const byteCount = Math.max(producedVideoBytes.length, oracleVideoBytes.length);

        for (let i = 0; i < byteCount; i++) {
            assertEqualHexCollect(
                diffs,
                `${fixture}.video.mdat.byte[${i}]`,
                producedVideoBytes[i],
                oracleVideoBytes[i]
            );
        }

        if (diffs.length) {
            console.table(diffs.slice(0, 50));
            throw new Error(
                `${fixture}: video mdat mismatch (${diffs.length} bytes differ)`
            );
        }
    }
}

export async function testNativeMuxer_MDAT_Length_Equals_Sum_Of_STSZ() {

    const resp = await fetch("reference/reference_av_opus.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    const mp4CompilerState = await runGoldenMp4AVTestClient({ mp4Bytes });

    prepareTracksForStructuralDerivation({ mp4CompilerState });
    for (const track of mp4CompilerState.tracks) {
        deriveStructuralStateInPlace({ track });
    }

    const audioTrack = mp4CompilerState.tracks[1];

    const stszParams = deriveStszIntentFromPayloads({
        accessUnits: audioTrack.semanticCore.accessUnits,
        accessUnitPayloads: audioTrack.payloads.accessUnitPayloads
    });

    let expectedLength;

    if (stszParams.sampleSize === 0) {
        // Variable-size samples
        expectedLength = stszParams.sizes.reduce((n, s) => n + s, 0);
    } else {
        // Constant-size samples
        expectedLength = stszParams.sampleSize * stszParams.sampleCount;
    }

    const mdatFacts = gatherTrackMdatFactsFromChunks({
        accessUnitGroups: audioTrack.chunks,
        accessUnitPayloads: audioTrack.payloads.accessUnitPayloads
    });

    const mdatPayload = normalizeTrackMdatFactsForTests(mdatFacts);

    assertEqual(
        "MDAT payload length equals sum(STSZ)",
        mdatPayload.length,
        expectedLength
    );
}

export async function test_getSamplesChunkedInFfmpegOpusFormat_basic() {

    // ---------------------------------------------------------
    // ARRANGE: extract oracle-derived access units
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_av_opus.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    const stblReport = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4Bytes,
        "moov/trak[1]/mdia/minf/stbl"
    ).readBoxReport();

    // These samples already include packetIndex derived from MDAT contiguity
    const samples = stblReport.derived.samplesOneSamplePerFrame;

    // ---------------------------------------------------------
    // ACT: apply FFmpeg Opus chunking
    // ---------------------------------------------------------

    const chunks = getSamplesChunkedInFfmpegOpusFormat({ samples });

    const expectedChunks = fixtures();
    assertEqual( "First chunk samples matches oracle", chunks[0].samples[0].sample,
        {
            "dts": 0,
            "pts": 0,
            "duration": 960,
            "size": 240,
            "offset": 4384,
            "isSync": true,
            "packetIndex": 0
        }
    )

    for (let chunkIndex = 0; chunkIndex < expectedChunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];
        const expected = expectedChunks[chunkIndex];

        for (let i = 0; i < expected.samples.length; i++) {
            if (chunk.samples[i].sample.packetIndex !== expected.samples[i].sample.packetIndex) {
                throw new Error(
                    "FAIL: packetIndex mismatch\n" +
                    "chunk=" + chunkIndex + "\n" +
                    "sample=" + i
                );
            }
        }
    }

}

export function extractOracleTrackMdatBytes({ mp4Bytes, trackIndex }) {

    const oracleMdat = extractOracleMdatPayload(mp4Bytes);

    const oracleTrackTables = extractOracleTrackTables({ mp4Bytes, trackIndex });

    const trackMdatBytes = buildTrackMdatBytesFromOracle({
        mp4Bytes,
        stco: oracleTrackTables.stco,
        stsz: oracleTrackTables.stsz,
        stsc: oracleTrackTables.stsc
    });

    return trackMdatBytes;
}

function extractOracleMdatPayload(mp4Bytes) {

    const mdatReport =
        getGoldenTruthBox
        .getSemanticBoxDataByPathFromMp4File(
            mp4Bytes,
            "mdat"
        )
        .readBoxReport();

    const mdatBoxBytes =
        mdatReport.raw;

    const payloadBytes =
        mdatBoxBytes.slice(8);

    const payloadFileOffset =
        mdatReport.offset + 8;

    return {
        payloadBytes,
        payloadFileOffset
    };
}

function extractOracleTrackTables({ mp4Bytes, trackIndex }) {

    const stco =
        getGoldenTruthBox
        .getSemanticBoxDataByPathFromMp4File(
            mp4Bytes,
            `moov/trak[${trackIndex}]/mdia/minf/stbl/stco`
        )
        .readBoxReport()
        .box
        .fields;

    const stsz =
        getGoldenTruthBox
        .getSemanticBoxDataByPathFromMp4File(
            mp4Bytes,
            `moov/trak[${trackIndex}]/mdia/minf/stbl/stsz`
        )
        .readBoxReport()
        .box
        .fields;

    const stsc =
        getGoldenTruthBox
        .getSemanticBoxDataByPathFromMp4File(
            mp4Bytes,
            `moov/trak[${trackIndex}]/mdia/minf/stbl/stsc`
        )
        .readBoxReport()
        .box
        .fields;

    return {
        stco,
        stsz,
        stsc
    };
}

function buildTrackMdatBytesFromOracle({ mp4Bytes, stco, stsz, stsc }) {

    // ---------------------------------------------------------
    // Build samples-per-chunk lookup table
    // ---------------------------------------------------------

    const samplesPerChunkByIndex = [];

    for (let entryIndex = 0; entryIndex < stsc.entries.length; entryIndex++) {

        const stscEntry = stsc.entries[entryIndex];

        const firstChunkIndex = stscEntry.firstChunk - 1;

        let lastChunkIndex;

        if (entryIndex + 1 < stsc.entries.length) {
            lastChunkIndex = stsc.entries[entryIndex + 1].firstChunk - 2;
        }
        else {
            lastChunkIndex = stco.chunkOffsets.length - 1;
        }

        for ( let chunkIndex = firstChunkIndex; chunkIndex <= lastChunkIndex; chunkIndex++) {
            samplesPerChunkByIndex[chunkIndex] = stscEntry.samplesPerChunk;
            //console.log( "Chunk", chunkIndex + 1, "→ samplesPerChunk:", stscEntry.samplesPerChunk);
        }
    }

    // ---------------------------------------------------------
    // Slice MDAT payload chunk by chunk
    // ---------------------------------------------------------

    const chunkByteSlices = [];

    let sampleIndex = 0;

    for (let chunkIndex = 0; chunkIndex < stco.chunkOffsets.length; chunkIndex++) {

        const chunkFileOffset =
            stco.chunkOffsets[chunkIndex];

        const samplesInThisChunk =
            samplesPerChunkByIndex[chunkIndex];

        let chunkByteCount = 0;

        for (let sampleOffset = 0; sampleOffset < samplesInThisChunk; sampleOffset++) {
            chunkByteCount = chunkByteCount + stsz.sizes[sampleIndex];
            sampleIndex++;
        }

        const chunkBytes =
            mp4Bytes.slice(
                chunkFileOffset,
                chunkFileOffset + chunkByteCount
            );

        chunkByteSlices.push(chunkBytes);
    }

    // ---------------------------------------------------------
    // Concatenate all chunk bytes
    // ---------------------------------------------------------

    let totalByteCount = 0;

    for (const slice of chunkByteSlices) {
        totalByteCount = totalByteCount + slice.length;
    }

    const trackMdatBytes =
        new Uint8Array(totalByteCount);

    let writeOffset = 0;

    for (const slice of chunkByteSlices) {
        trackMdatBytes.set(slice, writeOffset);
        writeOffset = writeOffset + slice.length;
    }

    return trackMdatBytes;
}

/**
 * assertChunkTopologyMatchesOracle
 * ================================
 *
 * Verifies that compiler-derived chunk topology is *structurally equivalent*
 * to oracle container topology.
 *
 * This function:
 * - DOES NOT mutate compiler state
 * - DOES NOT derive chunks
 * - DOES NOT advance cursors during compilation
 * - DOES NOT slice access units
 *
 * It is a pure *test-only verifier*.
 *
 * What it proves:
 * - derived chunking covers all samples
 * - derived samples-per-chunk sequence matches oracle exactly
 *
 * If this passes, STSC and MDAT byte-for-byte equality is meaningful.
 */
export function assertChunkTopologyMatchesOracle({ derivedChunks, oracleStscEntries, oracleChunkOffsets, }) {

    // ---------------------------------------------------------
    // Preconditions
    // ---------------------------------------------------------

    if (!Array.isArray(derivedChunks) || derivedChunks.length === 0) {
        throw new Error(
            "assertChunkTopologyMatchesOracle: derivedChunks must be a non-empty array"
        );
    }

    if (!Array.isArray(oracleStscEntries) || oracleStscEntries.length === 0) {
        throw new Error(
            "assertChunkTopologyMatchesOracle: oracleStscEntries must be a non-empty array"
        );
    }

    if (!Array.isArray(oracleChunkOffsets) || oracleChunkOffsets.length === 0) {
        throw new Error(
            "assertChunkTopologyMatchesOracle: oracleChunkOffsets must be a non-empty array"
        );
    }

    // ---------------------------------------------------------
    // Step 1: Expand oracle STSC → samplesPerChunk[]
    // ---------------------------------------------------------

    const oracleSamplesPerChunk = [];

    for (let i = 0; i < oracleStscEntries.length; i++) {

        const entry = oracleStscEntries[i];
        const next  = oracleStscEntries[i + 1];

        const firstChunkIndex = entry.firstChunk - 1;
        const lastChunkIndex =
            next
            ? next.firstChunk - 2
            : oracleChunkOffsets.length - 1;

        for (let chunkIndex = firstChunkIndex; chunkIndex <= lastChunkIndex; chunkIndex++) {
            oracleSamplesPerChunk[chunkIndex] = entry.samplesPerChunk;
        }
    }

    if (oracleSamplesPerChunk.length !== oracleChunkOffsets.length) {
        throw new Error(
            "assertChunkTopologyMatchesOracle: oracle samplesPerChunk expansion length mismatch\n" +
            `expected=${oracleChunkOffsets.length}, actual=${oracleSamplesPerChunk.length}`
        );
    }

    // ---------------------------------------------------------
    // Step 2: Expand derived chunks → samplesPerChunk[]
    // ---------------------------------------------------------

    const derivedSamplesPerChunk =
        derivedChunks.map(chunk => {

            if (!Array.isArray(chunk.samples) || chunk.samples.length === 0) {
                throw new Error(
                    "assertChunkTopologyMatchesOracle: each derived chunk must have non-empty samples[]"
                );
            }

            return chunk.samples.length;
        });

    // ---------------------------------------------------------
    // Step 3: Compare samples-per-chunk sequences exactly
    // ---------------------------------------------------------

    if (derivedSamplesPerChunk.length !== oracleSamplesPerChunk.length) {
        throw new Error(
            "assertChunkTopologyMatchesOracle: chunk count mismatch\n" +
            `derived=${derivedSamplesPerChunk.length}, oracle=${oracleSamplesPerChunk.length}`
        );
    }

    for (let i = 0; i < oracleSamplesPerChunk.length; i++) {

        const oracleCount  = oracleSamplesPerChunk[i];
        const derivedCount = derivedSamplesPerChunk[i];

        if (oracleCount !== derivedCount) {
            throw new Error(
                "assertChunkTopologyMatchesOracle: samplesPerChunk mismatch\n" +
                `chunkIndex=${i}, derived=${derivedCount}, oracle=${oracleCount}`
            );
        }
    }

    // ---------------------------------------------------------
    // Step 4: Verify total sample coverage
    // ---------------------------------------------------------

    const totalDerivedSamples =
        derivedSamplesPerChunk.reduce((a, b) => a + b, 0);

    const totalOracleSamples =
        oracleSamplesPerChunk.reduce((a, b) => a + b, 0);

    if (totalDerivedSamples !== totalOracleSamples) {
        throw new Error(
            "assertChunkTopologyMatchesOracle: total sample count mismatch\n" +
            `derived=${totalDerivedSamples}, oracle=${totalOracleSamples}`
        );
    }
}

function assertOracleOpusChunkPatternIsFFmpegStyle({ trackIndex, mp4Bytes }) {
    // ---------------------------------------------------------
    // VERIFY DERIVED CHUNK TOPOLOGY AGAINST ORACLE (TEST-ONLY)
    // ---------------------------------------------------------

    const oracleStscEntries = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4Bytes,
        `moov/trak[${trackIndex}]/mdia/minf/stbl/stsc`
    ).readBoxReport().box.fields.entries;

    const oracleChunkOffsets = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4Bytes,
        `moov/trak[${trackIndex}]/mdia/minf/stbl/stco`
    ).readBoxReport().box.fields.chunkOffsets;

    // ---------------------------------------------------------
    // ORACLE DIAGNOSTIC: expand STSC → packets per chunk
    // ---------------------------------------------------------
    const oraclePacketsPerChunk = [];

    for (let i = 0; i < oracleStscEntries.length; i++) {

        const entry = oracleStscEntries[i];
        const next  = oracleStscEntries[i + 1];

        const firstChunkIndex = entry.firstChunk - 1;
        const lastChunkIndex =
            next
            ? next.firstChunk - 2
            : oracleChunkOffsets.length - 1;

        for (let chunkIndex = firstChunkIndex;
            chunkIndex <= lastChunkIndex;
            chunkIndex++) {

            oraclePacketsPerChunk.push(entry.samplesPerChunk);
        }
    }

    // ---------------------------------------------------------
    // ORACLE ASSERTION: verify FFmpeg Opus packet grouping rule
    // ---------------------------------------------------------

    function assertEqual(actual, expected, message) {
        if (actual !== expected) {
            throw new Error(
                `assertOracleOpusChunkPatternIsFFmpegStyle: ${message} ` +
                `(expected=${expected}, actual=${actual})`
            );
        }
    }

    const totalChunks = oraclePacketsPerChunk.length;

    if (totalChunks < 4) {
        throw new Error(
            "assertOracleOpusChunkPatternIsFFmpegStyle: oracle has fewer than 4 chunks, " +
            "cannot validate Opus grouping pattern"
        );
    }

    // Explicit head assertions
    assertEqual(oraclePacketsPerChunk[0], 1, "chunk[0] packets");
    assertEqual(oraclePacketsPerChunk[1], 1, "chunk[1] packets");
    assertEqual(oraclePacketsPerChunk[2], 2, "chunk[2] packets");
    assertEqual(oraclePacketsPerChunk[3], 2, "chunk[3] packets");

    // Repeating body pattern: [1, 2, 2]
    const repeatingPattern = [1, 2, 2];

    for (let i = 4; i < totalChunks; i++) {

        const expected = repeatingPattern[(i - 4) % repeatingPattern.length];

        const actual = oraclePacketsPerChunk[i];

        if (actual !== expected) {
            throw new Error(
                "assertOracleOpusChunkPatternIsFFmpegStyle: FFmpeg Opus packet grouping " +
                "deviates from expected [1,2,2] pattern\n" +
                `chunkIndex=${i}, expected=${expected}, actual=${actual}`
            );
        }
    }
}

function fixtures(index) {

    const chunks = [

        // chunk 0 — head: 1 packet
        {
            samples: [
                { sample: { packetIndex: 0 } }
            ]
        },

        // chunk 1 — head: 1 packet
        {
            samples: [
                { sample: { packetIndex: 1 } }
            ]
        },

        // chunk 2 — head: 2 packets (packetIndex 2)
        {
            samples: [
                { sample: { packetIndex: 2 } },
                { sample: { packetIndex: 2 } }
            ]
        },

        // chunk 3 — head: 2 packets (packetIndex 3)
        {
            samples: [
                { sample: { packetIndex: 3 } },
                { sample: { packetIndex: 3 } }
            ]
        },

        // chunk 4 — tail: 1 packet (packetIndex 4)
        {
            samples: [
                { sample: { packetIndex: 4 } }
            ]
        },

        // chunk 5 — tail: 2 packets (packetIndex 5)
        {
            samples: [
                { sample: { packetIndex: 5 } },
                { sample: { packetIndex: 5 } }
            ]
        },

        // chunk 6 — tail: 2 packets (packetIndex 6)
        {
            samples: [
                { sample: { packetIndex: 6 } },
                { sample: { packetIndex: 6 } }
            ]
        },

        // chunk 7 — tail: 1 packet (packetIndex 7)
        {
            samples: [
                { sample: { packetIndex: 7 } }
            ]
        },

        // chunk 8 — tail: 2 packets (packetIndex 8)
        {
            samples: [
                { sample: { packetIndex: 8 } },
                { sample: { packetIndex: 8 } }
            ]
        },

        // chunk 9 — tail: 2 packets (packetIndex 9)
        {
            samples: [
                { sample: { packetIndex: 9 } },
                { sample: { packetIndex: 9 } }
            ]
        },

        // chunk 10 — tail: 1 packet (packetIndex 10)
        {
            samples: [
                { sample: { packetIndex: 10 } }
            ]
        },

        // chunk 11 — tail: 2 packets (packetIndex 11)
        {
            samples: [
                { sample: { packetIndex: 11 } },
                { sample: { packetIndex: 11 } }
            ]
        },

        // chunk 12 — tail: 1 packet (packetIndex 12)
        {
            samples: [
                { sample: { packetIndex: 12 } }
            ]
        }

    ];
    return chunks;
}

/**
 * Test-only adapter.
 *
 * Normalizes track-local MDAT facts into the
 * legacy contiguous payload shape expected by
 * existing per-track MDAT tests.
 *
 * This deliberately hides chunk structure.
 */
export function normalizeTrackMdatFactsForTests(trackFacts) {

    const { chunks } = trackFacts;

    let total = 0;
    for (const c of chunks) total += c.byteLength;

    const payload = new Uint8Array(total);

    let cursor = 0;
    for (const c of chunks) {
        payload.set(c.bytes, cursor);
        cursor += c.byteLength;
    }

    return payload;
}
