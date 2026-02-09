import { runGoldenMp4AVTestClient } from "./clients/goldenMp4AVSourceClient.js";
import {
    assertExists,
    assertNotExists,
    assertEqual,
    assertEqualHex,
    assertEqualHexCollect,
    assertObjectEqual,
} from "./assertions.js";

import { deriveSyncSampleNumbers } from "../derivers/deriveSyncSampleNumbers.js";
import { applySyncRepresentationPolicy } from "../policies/applySyncRepresentationPolicy.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
import { buildSyncRepresentationIntent } from "../builders/buildSyncRepresentationIntent.js";

export async function testNativeMuxer_SyncRepresentation_CompilerPath_Video_Equals_FFmpegOracle() {

    // ---------------------------------------------------------
    // Load oracle MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Run golden client (authoritative inputs)
    // ---------------------------------------------------------
    const { tracks } = await runGoldenMp4AVTestClient({ mp4Bytes });
    const videoTrack = tracks[0];

    // ---------------------------------------------------------
    // Derive semantic sync sample numbers (Tier 1/2)
    // ---------------------------------------------------------
    const derivedSyncSampleNumbers = deriveSyncSampleNumbers({ samples: videoTrack.semanticCore.accessUnits });

    // ---------------------------------------------------------
    // Apply sync representation policy (Tier 4)
    // ---------------------------------------------------------
    const syncRepresentation = applySyncRepresentationPolicy({ derivedSyncSampleNumbers, buildHints: videoTrack.buildHints });

    assertEqual("Sync representaion kind is stss", syncRepresentation.kind, "stss"); 
    assertEqual("Sync representaion emitStssSampleNumbersUnmodified is true", syncRepresentation.emitStssSampleNumbersUnmodified, true); 
    assertEqual("Sync representaion sample numbers is one", syncRepresentation.sampleNumbers, [1]); 

    // ---------------------------------------------------------
    // Build sync representation intent
    // ---------------------------------------------------------
    const syncIntent = buildSyncRepresentationIntent(syncRepresentation);


    // Extract oracle sync boxes
    // ---------------------------------------------------------
    const oracleStss =
        tryExtract(() =>
            getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4Bytes,
                "moov/trak[0]/mdia/minf/stbl/stss"
            )
        );

    const oracleSgpd =
        tryExtract(() =>
            getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4Bytes,
                "moov/trak[0]/mdia/minf/stbl/sgpd"
            )
        );

    const oracleSbgp =
        tryExtract(() =>
            getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4Bytes,
                "moov/trak[0]/mdia/minf/stbl/sbgp"
            )
            .getEmitterInput()
        );

    // ---------------------------------------------------------
    // Structural equivalence
    // ---------------------------------------------------------
    if (oracleStss !== null && oracleSgpd !== null) {
        throw new Error(
            "oracle invariant violated: track contains both stss and sgpd"
        );
    }

    assertExists( "STSS box was expected in the oracle but extraction failed", oracleStss);
    assertNotExists( "SGPD box was not expected in the oracle but one was found", oracleSgpd);
    assertNotExists( "SBGP box was not expected in the oracle but one was found", oracleSbgp);

    assertExists("syncIntent exists", syncIntent);
    assertExists("syncIntent.stss exists", syncIntent.stss);

    assertObjectEqual(
        "emitted STSS intent matches oracle",
        syncIntent.stss,
        oracleStss.getEmitterInput()
    );

    const emittedStssBytes = serializeBoxTree(EmitterRegistry.emit("moov/trak/mdia/minf/stbl/stss", syncIntent.stss));

    for (let i = 0; i < oracleStss.readBoxReport().raw.length; i++) {
        assertEqualHex(
            `stss.byte[${i}]`,
            emittedStssBytes[i],
            oracleStss.readBoxReport().raw[i]
        );
    }
}

export async function testNativeMuxer_SyncRepresentation_CompilerPath_Mp4a_Equals_FFmpegOracle() {

    // ---------------------------------------------------------
    // Load oracle MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Run golden client (authoritative inputs)
    // ---------------------------------------------------------
    const { tracks } = await runGoldenMp4AVTestClient({ mp4Bytes });
    const audioTrack = tracks[1];

    // ---------------------------------------------------------
    // Derive semantic sync sample numbers (Tier 1/2)
    // ---------------------------------------------------------
    const derivedSyncSampleNumbers = deriveSyncSampleNumbers({ samples: audioTrack.semanticCore.accessUnits });

    // ---------------------------------------------------------
    // Apply sync representation policy (Tier 4)
    // ---------------------------------------------------------
    const syncRepresentation = applySyncRepresentationPolicy({ derivedSyncSampleNumbers, buildHints: audioTrack.buildHints });

    assertEqual( "Sync representation kind is sgpd/sbgp", syncRepresentation.kind, "sgpd/sbgp");

    // ---------------------------------------------------------
    // Build sync representation intent
    // ---------------------------------------------------------
    const syncIntent = buildSyncRepresentationIntent(syncRepresentation);

    // ---------------------------------------------------------
    // Extract oracle sync boxes
    // ---------------------------------------------------------
    const oracleStss =
        tryExtract(() =>
            getGoldenTruthBox
                .getSemanticBoxDataByPathFromMp4File(
                    mp4Bytes,
                    "moov/trak[1]/mdia/minf/stbl/stss"
                )
        );

    const oracleSgpd =
        tryExtract(() =>
            getGoldenTruthBox
                .getSemanticBoxDataByPathFromMp4File(
                    mp4Bytes,
                    "moov/trak[1]/mdia/minf/stbl/sgpd"
                )
        );

    const oracleSbgp =
        tryExtract(() =>
            getGoldenTruthBox
                .getSemanticBoxDataByPathFromMp4File(
                    mp4Bytes,
                    "moov/trak[1]/mdia/minf/stbl/sbgp"
                )
        );

    // ---------------------------------------------------------
    // Structural equivalence
    // ---------------------------------------------------------
    if (oracleStss !== null && oracleSgpd !== null) {
        throw new Error(
            "oracle invariant violated: audio track contains both stss and sgpd"
        );
    }

    assertNotExists( "STSS box was not expected in the oracle but one was found", oracleStss);
    assertExists( "SGPD box was expected in the oracle but extraction failed", oracleSgpd);
    assertExists( "SBGP box was expected in the oracle but extraction failed", oracleSbgp);

    assertExists("syncIntent exists", syncIntent);
    assertExists("syncIntent.sgpd exists", syncIntent.sgpd);
    assertExists("syncIntent.sbgp exists", syncIntent.sbgp);

    // ---------------------------------------------------------
    // Intent equivalence
    // ---------------------------------------------------------
    assertObjectEqual( "emitted SGPD intent matches oracle", syncIntent.sgpd, oracleSgpd.getEmitterInput());
    assertObjectEqual( "emitted SBGP intent matches oracle", syncIntent.sbgp, oracleSbgp.getEmitterInput());

    // ---------------------------------------------------------
    // Byte-for-byte equivalence — SGPD / SBGP via STBL assembly
    // ---------------------------------------------------------

    const minimalStsdIntent = {
        sampleEntries: [
            { type: "mp4a", body: [], children: [] }
        ]
    };

    const minimalSttsIntent = {
        entries: []
    };

    const minimalStscIntent = {
        entries: [
            {
                firstChunk: 1,
                samplesPerChunk: 1,
                sampleDescriptionIndex: 1
            }
        ]
    };

    const minimalStszIntent = {
        sampleSize: 0,
        sampleCount: 1,
        sizes: [1]
    };

    const stblIntent = {
        stsd: minimalStsdIntent,
        stts: minimalSttsIntent,
        stsc: minimalStscIntent,
        stsz: minimalStszIntent,
        stco: { chunkOffsets: [] },

        // Sync representation under test
        sgpd: syncIntent.sgpd,
        sbgp: syncIntent.sbgp,
    };

    const stblNode =
        EmitterRegistry.assemble(
            "moov/trak/mdia/minf/stbl",
            stblIntent
        );

    const emittedStblBytes = serializeBoxTree(stblNode);

    const emittedSgpd =
        tryExtract(() =>
            getGoldenTruthBox.getSemanticBoxDataFromBox({
                boxBytes: emittedStblBytes,
                sourceRegistryKey: "moov/trak/mdia/minf/stbl",
                targetBoxPath: "moov/trak/mdia/minf/stbl/sgpd",
            })
        );

    const emittedSbgp =
        tryExtract(() =>
            getGoldenTruthBox.getSemanticBoxDataFromBox({
                boxBytes: emittedStblBytes,
                sourceRegistryKey: "moov/trak/mdia/minf/stbl",
                targetBoxPath: "moov/trak/mdia/minf/stbl/sbgp",
            })
        );

    assertObjectEqual(
        "emitted sgpd intent matches oracle",
        emittedSgpd.getEmitterInput(),
        oracleSgpd.getEmitterInput()
    );

    assertObjectEqual(
        "emitted sbgp intent matches oracle",
        emittedSbgp.getEmitterInput(),
        oracleSbgp.getEmitterInput()
    );


    for (let i = 0; i < emittedSgpd.readBoxReport().raw.length; i++) {
        assertEqualHex(
            `sgpd.byte[${i}]`,
            emittedSgpd.readBoxReport().raw[i],
            oracleSgpd.readBoxReport().raw[i]
        );
    }

    for (let i = 0; i < emittedSbgp.readBoxReport().raw.length; i++) {
        assertEqualHex(
            `sbgp.byte[${i}]`,
            emittedSbgp.readBoxReport().raw[i],
            oracleSbgp.readBoxReport().raw[i]
        );
    }
}

export async function testNativeMuxer_SyncRepresentation_CompilerPath_Opus_Equals_FFmpegOracle() {

    // ---------------------------------------------------------
    // Load oracle MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_av_opus.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Run golden client (authoritative inputs)
    // ---------------------------------------------------------
    const { tracks } = await runGoldenMp4AVTestClient({ mp4Bytes });
    const audioTrack = tracks[1];

    // ---------------------------------------------------------
    // Derive semantic sync sample numbers (Tier 1/2)
    // ---------------------------------------------------------
    const derivedSyncSampleNumbers = deriveSyncSampleNumbers({ samples: audioTrack.semanticCore.accessUnits });

    // ---------------------------------------------------------
    // Apply sync representation policy (Tier 4)
    // ---------------------------------------------------------
    const syncRepresentation = applySyncRepresentationPolicy({ derivedSyncSampleNumbers, buildHints: audioTrack.buildHints });

    assertEqual( "Sync representation kind is sgpd/sbgp", syncRepresentation.kind, "sgpd/sbgp");

    // ---------------------------------------------------------
    // Build sync representation intent
    // ---------------------------------------------------------
    const syncIntent = buildSyncRepresentationIntent(syncRepresentation);

    // ---------------------------------------------------------
    // Extract oracle sync boxes
    // ---------------------------------------------------------
    const oracleStss =
        tryExtract(() =>
            getGoldenTruthBox
                .getSemanticBoxDataByPathFromMp4File(
                    mp4Bytes,
                    "moov/trak[1]/mdia/minf/stbl/stss"
                )
        );

    const oracleSgpd =
        tryExtract(() =>
            getGoldenTruthBox
                .getSemanticBoxDataByPathFromMp4File(
                    mp4Bytes,
                    "moov/trak[1]/mdia/minf/stbl/sgpd"
                )
        );

    const oracleSbgp =
        tryExtract(() =>
            getGoldenTruthBox
                .getSemanticBoxDataByPathFromMp4File(
                    mp4Bytes,
                    "moov/trak[1]/mdia/minf/stbl/sbgp"
                )
        );

    // ---------------------------------------------------------
    // Structural equivalence
    // ---------------------------------------------------------
    if (oracleStss !== null && oracleSgpd !== null) {
        throw new Error(
            "oracle invariant violated: audio track contains both stss and sgpd"
        );
    }

    assertNotExists( "STSS box was not expected in the oracle but one was found", oracleStss);
    assertExists( "SGPD box was expected in the oracle but extraction failed", oracleSgpd);
    assertExists( "SBGP box was expected in the oracle but extraction failed", oracleSbgp);

    assertExists("syncIntent exists", syncIntent);
    assertExists("syncIntent.sgpd exists", syncIntent.sgpd);
    assertExists("syncIntent.sbgp exists", syncIntent.sbgp);

    // ---------------------------------------------------------
    // Intent equivalence
    // ---------------------------------------------------------
    assertObjectEqual( "emitted SGPD intent matches oracle", syncIntent.sgpd, oracleSgpd.getEmitterInput());
    assertObjectEqual( "emitted SBGP intent matches oracle", syncIntent.sbgp, oracleSbgp.getEmitterInput());

    // ---------------------------------------------------------
    // Byte-for-byte equivalence — SGPD / SBGP via STBL assembly
    // ---------------------------------------------------------

    const minimalStsdIntent = {
        sampleEntries: [
            { type: "mp4a", body: [], children: [] }
        ]
    };

    const minimalSttsIntent = {
        entries: []
    };

    const minimalStscIntent = {
        entries: [
            {
                firstChunk: 1,
                samplesPerChunk: 1,
                sampleDescriptionIndex: 1
            }
        ]
    };

    const minimalStszIntent = {
        sampleSize: 0,
        sampleCount: 1,
        sizes: [1]
    };

    const stblIntent = {
        stsd: minimalStsdIntent,
        stts: minimalSttsIntent,
        stsc: minimalStscIntent,
        stsz: minimalStszIntent,
        stco: { chunkOffsets: [] },

        // Sync representation under test
        sgpd: syncIntent.sgpd,
        sbgp: syncIntent.sbgp,
    };

    const stblNode =
        EmitterRegistry.assemble(
            "moov/trak/mdia/minf/stbl",
            stblIntent
        );

    const emittedStblBytes = serializeBoxTree(stblNode);

    const emittedSgpd =
        tryExtract(() =>
            getGoldenTruthBox.getSemanticBoxDataFromBox({
                boxBytes: emittedStblBytes,
                sourceRegistryKey: "moov/trak/mdia/minf/stbl",
                targetBoxPath: "moov/trak/mdia/minf/stbl/sgpd",
            })
        );

    const emittedSbgp =
        tryExtract(() =>
            getGoldenTruthBox.getSemanticBoxDataFromBox({
                boxBytes: emittedStblBytes,
                sourceRegistryKey: "moov/trak/mdia/minf/stbl",
                targetBoxPath: "moov/trak/mdia/minf/stbl/sbgp",
            })
        );

    assertObjectEqual(
        "emitted sgpd intent matches oracle",
        emittedSgpd.getEmitterInput(),
        oracleSgpd.getEmitterInput()
    );

    assertObjectEqual(
        "emitted sbgp intent matches oracle",
        emittedSbgp.getEmitterInput(),
        oracleSbgp.getEmitterInput()
    );


    for (let i = 0; i < emittedSgpd.readBoxReport().raw.length; i++) {
        assertEqualHex(
            `sgpd.byte[${i}]`,
            emittedSgpd.readBoxReport().raw[i],
            oracleSgpd.readBoxReport().raw[i]
        );
    }

    for (let i = 0; i < emittedSbgp.readBoxReport().raw.length; i++) {
        assertEqualHex(
            `sbgp.byte[${i}]`,
            emittedSbgp.readBoxReport().raw[i],
            oracleSbgp.readBoxReport().raw[i]
        );
    }
}

async function loadWebCodecsFixtures() {
    const resp = await fetch(
        "./fixtures/webcodecs_opus_av_access_units.json"
    );
    return await resp.json();
}

export async function testNativeMuxer_SyncRepresentation_WebCodecs_NoHints_EmitsNothing() {

    const fixtures = await loadWebCodecsFixtures();

    const accessUnits = fixtures[0].accessUnits;

    const derivedSyncSampleNumbers =
        deriveSyncSampleNumbers({ samples: accessUnits });

    const syncRepresentation =
        applySyncRepresentationPolicy({
            derivedSyncSampleNumbers,
            buildHints: {}
        });

    const syncIntent = buildSyncRepresentationIntent(syncRepresentation);

    assertEqual("no sync intent", syncIntent, null);
}

function tryExtract(fn) {
    try {
        const result = fn();

        // New contract: optional absence
        if (result && result.found === false) {
            return null;
        }

        return result;
    } catch {
        return null;
    }
}

