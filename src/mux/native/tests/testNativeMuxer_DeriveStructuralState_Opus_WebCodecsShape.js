import { deriveStructuralStateInPlace }
    from "../derivers/deriveStructuralStateInPlace.js";

import { runGoldenMp4AVTestClient }
    from "./clients/goldenMp4AVSourceClient.js";

import { assertEqual, assertExists }
    from "./assertions.js";

import { deriveSemanticTrackFamily }
    from "../derivers/deriveSemanticTrackFamily.js";

import { adaptStscEntriesToEmitterParams }
    from "../adapters/adaptStscEntriesToEmitterParams.js";

import { serializeBoxTree }
    from "../serializer/serializeBoxTree.js";

import { EmitterRegistry }
    from "../box-emitters/EmitterRegistry.js";

import { getGoldenTruthBox }
    from "./goldenTruthExtractors/index.js";

import {
    normalizeAccessUnitsInPlace
}   from "../normalization/access-units/index.js";

import { getSumOfAccessUnitDurations }
    from "../compiler/compileMp4.js";

async function loadWebCodecsFixtures() {
    const resp = await fetch(
        "./fixtures/webcodecs_opus_av_access_units.json"
    );
    return await resp.json();
}

/**
 * STSC is a physical container box. Its bytes represent chunk layout on disk, nothing else.
 * 
 * The compiler must reproduce STSC bytes exactly when given sufficient hints derived from an oracle container.
 * 
 * WebCodecs inputs alone are insufficient to determine STSC shape, so hints are required.
 * 
 * Hints supply missing degrees of freedom, not overrides and not raw box bytes.
 * 
 * The compiler must re-derive STSC from accessUnits plus hints, never copy STSC through.
 * 
 * Any failure to reproduce STSC byte-for-byte is a compiler bug, not a test problem.
 *
 *
 * tldr: “When given semantic inputs plus injected container topology, the compiler reproduces STSC byte-for-byte.”
 *
 * This tests, and 
*/
export async function testNativeMuxer_WhenGivenSemanticInputsPlusOracleContainerTopology_MustReproduceStscByteForByte_Opus() {

    console.warn(
        "This test is deprecated, replace with a new invariant: " +
        "“When given semantic inputs only, the compiler derives a chunk model that is provably" +
        "equivalent to the oracle, therefore producing byte-for-byte identical STSC and MDAT.”"
    )

    return;
    // ---------------------------------------------------------
    // 1. Load WebCodecs-compatible Opus oracle
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_av_opus.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());


    const oracleStscReportProbe =
        getGoldenTruthBox
        .getSemanticBoxDataByPathFromMp4File(
            mp4Bytes,
            "moov/trak[1]/mdia/minf/stbl/stsc"
        )
        .readBoxReport();

     console.log("Opus oracle stsc box: ", oracleStscReportProbe.box);


    const { tracks } = await runGoldenMp4AVTestClient({ mp4Bytes });

    console.log("Opus compiler inputs", tracks);

    const videoTrack = tracks[0];
    videoTrack.semanticTrackFamily = deriveSemanticTrackFamily(videoTrack);

    const audioTrack = tracks[1];
    audioTrack.semanticTrackFamily = deriveSemanticTrackFamily(audioTrack);

    // Preconditions
    assertEqual( "opus codec", audioTrack.semanticCore.codec.codec, "opus");
    assertEqual( "avc1 codec", videoTrack.semanticCore.codec.codec, "avc1");

    //assertEqual( "audio no oracle packetRuns", audioTrack.semanticHints?.packetRuns, undefined);
    assertEqual( "video no oracle packetRuns", videoTrack.semanticHints?.packetRuns, undefined);

    // Precondition: no trackDuration yet
    assertEqual( "Audio precondition: trackDuration absent", audioTrack.trackDuration, undefined);
    assertEqual( "Video precondition: trackDuration absent", videoTrack.trackDuration, undefined);

    const audioAccessUnits = audioTrack.semanticCore.accessUnits;
    const videoAccessUnits = videoTrack.semanticCore.accessUnits;

    // ---------------------------------------------------------
    // 2. Derive structural state
    // ---------------------------------------------------------
    let mp4CompilerState = { tracks: [ audioTrack ] };

    for (const track of mp4CompilerState.tracks) {
        deriveStructuralStateInPlace({ track });
    }

    // ---------------------------------------------------------
    // 3. Assertions — PACKETIZED default
    // ---------------------------------------------------------
    assertExists("stscEntries", audioTrack.stscEntries);

    const oracleStscEntries =
        getGoldenTruthBox
        .getSemanticBoxDataByPathFromMp4File(
            mp4Bytes,
            "moov/trak[1]/mdia/minf/stbl/stsc"
        )
        .readBoxReport()
        .box
        .fields
        .entries;

    assertEqual(
        "stsc entry count",
        audioTrack.stscEntries.length,
        oracleStscEntries.length
    );

    for (let i = 0; i < oracleStscEntries.length; i++) {
        assertEqual(
            `samplesPerChunk[${i}]`,
            audioTrack.stscEntries[i].samplesPerChunk,
            oracleStscEntries[i].samplesPerChunk
        );
    }

    // audioTrack duration derived
    assertExists("audioTrackDuration", audioTrack.trackDuration);
    assertEqual(
        "audioTrackDuration is integer",
        Number.isInteger(audioTrack.trackDuration),
        true
    );


    // ---------------------------------------------------------
    // DEBUG: Inspect oracle STSC (structure + bytes)
    // ---------------------------------------------------------

    const oracleStscReport =
        getGoldenTruthBox
        .getSemanticBoxDataByPathFromMp4File(
            mp4Bytes,
            "moov/trak[1]/mdia/minf/stbl/stsc"
        )
        .readBoxReport();

    // structural view
    console.log("ORACLE STSC fields:", {
        entryCount: oracleStscReport.box.fields.entries.length,
        entries: oracleStscReport.box.fields.entries
    });

    // raw byte view (first N bytes so logs stay readable)
    const raw = oracleStscReport.raw;
    const MAX = Math.min(raw.length, 128);

    console.log( "ORACLE STSC raw bytes:", Array.from(oracleStscReport.raw));


    // ---------------------------------------------------------
    // 4. STSC byte-for-byte (oracle lock)
    // ---------------------------------------------------------

    // 4a. Adapt derived STSC entries → emitter params
    const audioStscParams = adaptStscEntriesToEmitterParams({ stscEntries: audioTrack.stscEntries, chunks: audioTrack.chunks });

    // 4b. Emit + serialize produced STSC
    const audioOutStscBytes =
        serializeBoxTree(
            EmitterRegistry.emit(
                "moov/trak/mdia/minf/stbl/stsc",
                audioStscParams
            )
        );

    // 4c. Extract oracle STSC bytes
    const audioRefStscBytes =
        getGoldenTruthBox
        .getSemanticBoxDataByPathFromMp4File(
            mp4Bytes,
            "moov/trak[1]/mdia/minf/stbl/stsc"
        )
        .readBoxReport()
        .raw;

    // 4d. Byte-for-byte compare
    assertEqual("Audio stsc.size", audioOutStscBytes.length, audioRefStscBytes.length);
    for (let i = 0; i < audioRefStscBytes.length; i++) {
        assertEqual(`stsc.byte[${i}]`, audioOutStscBytes[i], audioRefStscBytes[i]);
    }

    // ---------------------------------------------------------
    // 2. Derive structural state
    // ---------------------------------------------------------
    mp4CompilerState = { tracks: [ videoTrack ] };

    for (const track of mp4CompilerState.tracks) {
        deriveStructuralStateInPlace({ track });
    }

    const VideoTrack = mp4CompilerState.tracks[0];

    // ---------------------------------------------------------
    // 3. Assertions — PACKETIZED default
    // ---------------------------------------------------------

    // chunks exist
    assertExists("chunks", VideoTrack.chunks);
    assertEqual( "chunk count equals access unit count", VideoTrack.chunks.length, videoAccessUnits.length);

    // STSC: one sample per chunk
    assertExists("stscEntries", VideoTrack.stscEntries);
    for (const entry of VideoTrack.stscEntries) {
        assertEqual( "samplesPerChunk", entry.samplesPerChunk, 1);
    }

    // VideoTrack duration derived
    assertExists("VideoTrackDuration", videoTrack.trackDuration);
    assertEqual(
        "VideoTrackDuration is integer",
        Number.isInteger(VideoTrack.trackDuration),
        true
    );

    // ---------------------------------------------------------
    // 4. STSC byte-for-byte (oracle lock)
    // ---------------------------------------------------------

    // 4a. Adapt derived STSC entries → emitter params
    const videoStscParams = adaptStscEntriesToEmitterParams({ stscEntries: videoTrack.stscEntries, chunks: videoTrack.chunks });

    // 4b. Emit + serialize produced STSC
    const videoOutStscBytes =
        serializeBoxTree(
            EmitterRegistry.emit(
                "moov/trak/mdia/minf/stbl/stsc",
                videoStscParams
            )
        );

    // 4c. Extract oracle STSC bytes
    const videoRefStscBytes =
        getGoldenTruthBox
        .getSemanticBoxDataByPathFromMp4File(
            mp4Bytes,
            "moov/trak[0]/mdia/minf/stbl/stsc"
        )
        .readBoxReport()
        .raw;

    // 4d. Byte-for-byte compare
    assertEqual("stsc.size", videoOutStscBytes.length, videoRefStscBytes.length);
    for (let i = 0; i < videoRefStscBytes.length; i++) {
        assertEqual(`stsc.byte[${i}]`, videoOutStscBytes[i], videoRefStscBytes[i]);
    }

}

/**
 * STSC is a physical container box. Its bytes represent chunk layout on disk, nothing else.
 * 
 * The compiler must reproduce STSC bytes exactly when given sufficient hints derived from an oracle container.
 * 
 * WebCodecs inputs alone are insufficient to determine STSC shape, so hints are required.
 * 
 * Hints supply missing degrees of freedom, not overrides and not raw box bytes.
 * 
 * The compiler must re-derive STSC from accessUnits plus hints, never copy STSC through.
 * 
 * Any failure to reproduce STSC byte-for-byte is a compiler bug, not a test problem.
 */
export async function testNativeMuxer_WhenGivenSemanticInputsPlusOracleContainerSuppliedHints_MustReproduceStscByteForByte_Mp4a() {

    console.warn(
        "DEPRECATED TEST.\n" +
        "\n" +
        "This test depends on the old mp4a containerPacketRuns hint model,\n" +
        "which has been retired.\n" +
        "\n" +
        "The compiler no longer reproduces STSC by injecting oracle container\n" +
        "topology for mp4a. Packetization is now derived structurally.\n" +
        "\n" +
        "This test asserts invariants that no longer hold (e.g. video packetIndex absence).\n" +
        "\n" +
        "Superseded by:\n" +
        "- testNativeMuxer_OPUS_STSC_MDAT_CompilerPath_with_FFmpegOpus_ChunkGroupPolicy_Equals_FFmpegOracle\n" +
        "\n" +
        "Future work:\n" +
        "- Reintroduce mp4a under the new packetization + chunk model,\n" +
        "  or remove this test entirely."
    );
    return

    // ---------------------------------------------------------
    // 1. Load mp4a oracle
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    const oracleStscReportProbe =
        getGoldenTruthBox
        .getSemanticBoxDataByPathFromMp4File(
            mp4Bytes,
            "moov/trak[1]/mdia/minf/stbl/stsc"
        )
        .readBoxReport();

    console.log("Mp4a oracle stsc box: ", oracleStscReportProbe.box);


    const { tracks } = await runGoldenMp4AVTestClient({ mp4Bytes });

    console.log("mp4 compiler inputs", tracks);

    const videoTrack = tracks[0];
    videoTrack.semanticTrackFamily = deriveSemanticTrackFamily(videoTrack);

    const audioTrack = tracks[1];
    audioTrack.semanticTrackFamily = deriveSemanticTrackFamily(audioTrack);

    // Preconditions
    assertEqual( "mp4a codec", audioTrack.semanticCore.codec.codec, "mp4a");
    assertEqual( "avc1 codec", videoTrack.semanticCore.codec.codec, "avc1");

    //assertEqual( "audio no oracle packetRuns", audioTrack.semanticHints?.packetRuns, undefined);
    assertEqual( "video no oracle packetRuns", videoTrack.semanticHints?.packetRuns, undefined);

    // Precondition: no trackDuration yet
    assertEqual( "Audio precondition: trackDuration absent", audioTrack.trackDuration, undefined);
    assertEqual( "Video precondition: trackDuration absent", videoTrack.trackDuration, undefined);

    const audioAccessUnits = audioTrack.semanticCore.accessUnits;
    const videoAccessUnits = videoTrack.semanticCore.accessUnits;

    // ---------------------------------------------------------
    // 2. Derive structural state
    // ---------------------------------------------------------
    let mp4CompilerState = { tracks: [ audioTrack ] };

    for (const track of mp4CompilerState.tracks) {
        deriveStructuralStateInPlace({ track });
    }

    // ---------------------------------------------------------
    // 3. Assertions — PACKETIZED default
    // ---------------------------------------------------------

    // packetIndex assigned
    for (let i = 0; i < audioAccessUnits.length; i++) {
        assertExists(`packetIndex[${i}]`, audioAccessUnits[i].packetIndex);
    }

    //  Packetization monotonic / bounded 
    for (let i = 1; i < audioAccessUnits.length; i++) {
        assertEqual(
            `packetIndex monotonic [${i}]`,
            audioAccessUnits[i].packetIndex >= audioAccessUnits[i - 1].packetIndex,
            true
        );
    }

    // chunks exist
    assertExists("chunks", audioTrack.chunks);

    // audioTrack duration derived
    assertExists("audioTrackDuration", audioTrack.trackDuration);
    assertEqual(
        "audioTrackDuration is integer",
        Number.isInteger(audioTrack.trackDuration),
        true
    );


    // ---------------------------------------------------------
    // DEBUG: Inspect oracle STSC (structure + bytes)
    // ---------------------------------------------------------

    const oracleStscReport =
        getGoldenTruthBox
        .getSemanticBoxDataByPathFromMp4File(
            mp4Bytes,
            "moov/trak[1]/mdia/minf/stbl/stsc"
        )
        .readBoxReport();


    try {
        assertEqual( "stsc entry count", audioTrack.stscEntries.length, oracleStscReport.box.fields.entries.length);
    }
    catch (e) {
        console.log(e);
        console.log( "stsc entries:", audioTrack.stscEntries, oracleStscReport.box.fields.entries);
    }

    for (let i = 0; i < audioTrack.stscEntries.length; i++) {
        assertEqual(
            `samplesPerChunk[${i}]`,
            audioTrack.stscEntries[i].samplesPerChunk,
            oracleStscReport.box.fields.entries[i].samplesPerChunk
        );
    }

    // structural view
    console.log("ORACLE STSC fields:", {
        entryCount: oracleStscReport.box.fields.entries.length,
        entries: oracleStscReport.box.fields.entries
    });

    // raw byte view (first N bytes so logs stay readable)
    const raw = oracleStscReport.raw;
    const MAX = Math.min(raw.length, 128);

    console.log(
        "ORACLE STSC raw bytes:",
        Array.from(oracleStscReport.raw)
    );


    // ---------------------------------------------------------
    // 4. STSC byte-for-byte (oracle lock)
    // ---------------------------------------------------------

    // 4a. Adapt derived STSC entries → emitter params
    const audioStscParams = adaptStscEntriesToEmitterParams({ stscEntries: audioTrack.stscEntries, chunks: audioTrack.chunks });

    // 4b. Emit + serialize produced STSC
    const audioOutStscBytes =
        serializeBoxTree(
            EmitterRegistry.emit(
                "moov/trak/mdia/minf/stbl/stsc",
                audioStscParams
            )
        );

    // 4c. Extract oracle STSC bytes
    const audioRefStscBytes =
        getGoldenTruthBox
        .getSemanticBoxDataByPathFromMp4File(
            mp4Bytes,
            "moov/trak[1]/mdia/minf/stbl/stsc"
        )
        .readBoxReport()
        .raw;

    // 4d. Byte-for-byte compare
    assertEqual("Audio stsc.size", audioOutStscBytes.length, audioRefStscBytes.length);
    for (let i = 0; i < audioRefStscBytes.length; i++) {
        assertEqual(`stsc.byte[${i}]`, audioOutStscBytes[i], audioRefStscBytes[i]);
    }

    // ---------------------------------------------------------
    // 2. Derive structural state
    // ---------------------------------------------------------
    mp4CompilerState = { tracks: [ videoTrack ] };

    for (const track of mp4CompilerState.tracks) {
        deriveStructuralStateInPlace({ track });
    }

    const VideoTrack = mp4CompilerState.tracks[0];

    // ---------------------------------------------------------
    // 3. Assertions — PACKETIZED default
    // ---------------------------------------------------------

    for (let i = 0; i < videoAccessUnits.length; i++) {
        assertEqual(
            `video packetIndex absent [${i}]`,
            videoAccessUnits[i].packetIndex,
            undefined
        );
    }

    // chunks exist
    assertExists("chunks", VideoTrack.chunks);
    assertEqual( "chunk count equals access unit count", VideoTrack.chunks.length, videoAccessUnits.length);

    // STSC: one sample per chunk
    assertExists("stscEntries", audioTrack.stscEntries);
    assertEqual(
        "stscEntries match oracle entry count",
        audioTrack.stscEntries.length,
        oracleStscReport.box.fields.entries.length
    );

    // VideoTrack duration derived
    assertExists("VideoTrackDuration", videoTrack.trackDuration);
    assertEqual(
        "VideoTrackDuration is integer",
        Number.isInteger(VideoTrack.trackDuration),
        true
    );

    // ---------------------------------------------------------
    // 4. STSC byte-for-byte (oracle lock)
    // ---------------------------------------------------------

    // 4a. Adapt derived STSC entries → emitter params
    const videoStscParams = adaptStscEntriesToEmitterParams({ stscEntries: videoTrack.stscEntries, chunks: videoTrack.chunks });

    // 4b. Emit + serialize produced STSC
    const videoOutStscBytes =
        serializeBoxTree(
            EmitterRegistry.emit(
                "moov/trak/mdia/minf/stbl/stsc",
                videoStscParams
            )
        );

    // 4c. Extract oracle STSC bytes
    const videoRefStscBytes =
        getGoldenTruthBox
        .getSemanticBoxDataByPathFromMp4File(
            mp4Bytes,
            "moov/trak[0]/mdia/minf/stbl/stsc"
        )
        .readBoxReport()
        .raw;

    // 4d. Byte-for-byte compare
    assertEqual("stsc.size", videoOutStscBytes.length, videoRefStscBytes.length);
    for (let i = 0; i < videoRefStscBytes.length; i++) {
        assertEqual(`stsc.byte[${i}]`, videoOutStscBytes[i], videoRefStscBytes[i]);
    }

}

export async function testNativeMuxer_WhenGivenWebCodecsInputs_MustProduceLegalStsc() {

    const fixtures = await loadWebCodecsFixtures();

    for (const fixture of fixtures) {

        console.log(fixtures);
        // -----------------------------------------------------
        // Clone inputs
        // -----------------------------------------------------
        const accessUnits = fixture.accessUnits.map(u => ({ ...u }));

        const codec = {
            codec: fixture.codec,
        }

        // -----------------------------------------------------
        // Build track
        // -----------------------------------------------------
        const track = {
            semanticCore: {
                accessUnits,
                codec
            },
            buildHints: {},
            semanticHints: {}
        };

        // Tier 1 (what compileMp4 does)
        track.semanticTrackFamily = deriveSemanticTrackFamily(track);

        // -----------------------------------------------------
        // Normalize (same as existing test)
        // -----------------------------------------------------
        normalizeAccessUnitsInPlace({ accessUnits: track.semanticCore.accessUnits, codec: track.semanticCore.codec.codec });

        track.trackDuration = getSumOfAccessUnitDurations(track.semanticCore.accessUnits);

        // -----------------------------------------------------
        // 4. Run structural derivation
        // -----------------------------------------------------
        const mp4CompilerState = {
            tracks: [ track ]
        };

        // Tier 2
        for (const track of mp4CompilerState.tracks) {
            deriveStructuralStateInPlace({ track });
        }

        // -----------------------------------------------------
        // 5. STSC must exist
        // -----------------------------------------------------
        assertExists(
            "stscEntries",
            track.stscEntries
        );

        assertEqual(
            "stscEntries non-empty",
            track.stscEntries.length > 0,
            true
        );

        // -----------------------------------------------------
        // 6. Chunk coverage must be exact
        // -----------------------------------------------------
        assertExists("chunks", track.chunks);

        let coveredSamples = 0;

        for (const chunk of track.chunks) {
            coveredSamples += chunk.samples.length;
        }

        assertEqual(
            "chunk coverage equals access unit count",
            coveredSamples,
            accessUnits.length
        );

        // -----------------------------------------------------
        // 7. STSC internal consistency
        // -----------------------------------------------------
        for (const entry of track.stscEntries) {

            assertExists("firstChunk", entry.firstChunk);
            assertExists("samplesPerChunk", entry.samplesPerChunk);

            assertEqual(
                "firstChunk is 1-based",
                entry.firstChunk >= 1,
                true
            );

            assertEqual(
                "samplesPerChunk is positive",
                entry.samplesPerChunk > 0,
                true
            );
        }

        // -----------------------------------------------------
        // 8. Track-family-specific invariants
        // -----------------------------------------------------
        if (track.semanticTrackFamily === "video") {

            for (let i = 0; i < accessUnits.length; i++) {
                assertEqual(
                    `video packetIndex absent [${i}]`,
                    accessUnits[i].packetIndex,
                    undefined
                );
            }

        } else if (track.semanticTrackFamily === "audio") {

            // Audio must have packetIndex assigned
            for (let i = 0; i < accessUnits.length; i++) {
                assertExists(
                    `audio packetIndex present [${i}]`,
                    accessUnits[i].packetIndex
                );
            }
        }
    }
}
