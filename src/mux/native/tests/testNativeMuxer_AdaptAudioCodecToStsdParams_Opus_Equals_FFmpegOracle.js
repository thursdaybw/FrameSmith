import { adaptAudioCodecConfigurationToStsdParams } from "../adapters/adaptAudioCodecConfigurationToStsdParams.js";
import { runGoldenMp4AVTestClient } from "./clients/goldenMp4AVSourceClient.js";
import {
    assertExists,
    assertEqual,
    assertEqualHex,
    assertEqualHexCollect,
} from "./assertions.js";

import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { buildStsdIntentFromSemanticTrack } from "../builders/buildStsdIntentFromSemanticTrack.js";
import { decodeFullBoxHeader } from "../box-schema/boxLayoutReaders.js";
import { adaptCodecConfigurationToStsdParams }
    from "../adapters/adaptCodecConfigurationToStsdParams.js";

export async function testNativeMuxer_STSD_CompilerPath_Opus_Equals_FFmpegOracle() {

    // ---------------------------------------------------------
    // Load oracle MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_av_opus.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Run golden client (authoritative compiler inputs)
    // ---------------------------------------------------------
    const { tracks } = await runGoldenMp4AVTestClient({ mp4Bytes });

    // ---------------------------------------------------------
    // Adapt semantic codec → raw STSD params (Tier 3)
    // ---------------------------------------------------------
    const stsdIntent = buildStsdIntentFromSemanticTrack({
        codecName:       tracks[1].semanticCore.codec.codec,
        semanticCodec:   tracks[1].semanticCore.codec,
        buildParameters: tracks[1].buildParameters,
        buildHints:      tracks[1].buildHints
    });

    console.log("emitted intent", stsdIntent); 

    const emittedStsdBytes =
        serializeBoxTree(
            EmitterRegistry.assemble(
                "moov/trak/mdia/minf/stbl/stsd",
                stsdIntent
            )
        );

    // ---------------------------------------------------------
    // 6. Extract oracle STSD bytes
    // ---------------------------------------------------------
    const oracleStsdBytes =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4Bytes,
                "moov/trak[1]/mdia/minf/stbl/stsd"
            )
            .readBoxReport()
            .raw;


    const oracleSampleEntry =
        getGoldenTruthBox
        .getSemanticBoxDataByPathFromMp4File(
            mp4Bytes,
            "moov/trak[1]/mdia/minf/stbl/stsd/sample[0]"
        )

    const emittedSampleEntry =
        getGoldenTruthBox
        .getSemanticBoxDataFromBox({
            boxBytes: emittedStsdBytes,
            sourceRegistryKey: "moov/trak/mdia/minf/stbl/stsd",
            targetBoxPath: "moov/trak/mdia/minf/stbl/stsd/sample[0]",
        })

    //console.table(oracleSampleEntry.readBoxReport().diagnostics);
    //console.table(emittedSampleEntry.readBoxReport().diagnostics);

    const oracleBtrt =
        getGoldenTruthBox
        .getSemanticBoxDataByPathFromMp4File(
            mp4Bytes,
            "moov/trak[1]/mdia/minf/stbl/stsd/sample[0]/btrt"
        )
        .readBoxReport()

    const emittedBtrt =
        getGoldenTruthBox
        .getSemanticBoxDataFromBox({
            boxBytes: emittedStsdBytes,
            sourceRegistryKey: "moov/trak/mdia/minf/stbl/stsd",
            targetBoxPath: "moov/trak/mdia/minf/stbl/stsd/sample[0]/btrt",
        })
        .readBoxReport()

    //console.table(oracleBtrt.diagnostics);
    //console.table(emittedBtrt.diagnostics);

    const oracleDops=
        getGoldenTruthBox
        .getSemanticBoxDataByPathFromMp4File(
            mp4Bytes,
            "moov/trak[1]/mdia/minf/stbl/stsd/sample[0]/dOps"
        )
        .readBoxReport()
        .raw;

    const emittedDops =
        getGoldenTruthBox
        .getSemanticBoxDataFromBox({
            boxBytes: emittedStsdBytes,
            sourceRegistryKey: "moov/trak/mdia/minf/stbl/stsd",
            targetBoxPath: "moov/trak/mdia/minf/stbl/stsd/sample[0]/dOps",
        })
        .readBoxReport()


    //console.table(oracleDops.diagnostics);
    //console.table(emittedDops.diagnostics);

    // ---------------------------------------------------------
    // 7. Byte-for-byte equivalence
    // ---------------------------------------------------------
    assertEqual(
        "stsd.size",
        emittedStsdBytes.length,
        oracleStsdBytes.length
    );

    for (let i = 0; i < oracleStsdBytes.length; i++) {
        assertEqualHex(
            `stsd.byte[${i}]`,
            emittedStsdBytes[i],
            oracleStsdBytes[i]
        );
    }
}

async function loadWebCodecsFixtures() {
    const resp = await fetch(
        "./fixtures/webcodecs_opus_av_access_units.json"
    );
    return await resp.json();
}


export async function testNativeMuxer_STSD_CompilerPath_Opus_WebCodecs_Equals_FFmpegOracle() {

    // ---------------------------------------------------------
    // Load oracle MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_av_opus.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Load WebCodecs fixtures
    // ---------------------------------------------------------
    const fixtures      = await loadWebCodecsFixtures();
    const webcodecsDops = new Uint8Array(fixtures[1].dOps);

    // ---------------------------------------------------------
    // Run golden client ONLY for buildParameters / btrt
    // ---------------------------------------------------------
    const { tracks } = await runGoldenMp4AVTestClient({ mp4Bytes });
    const audioTrack = tracks[1];

    assertEqual("audio codec", audioTrack.semanticCore.codec.codec, "opus");

    // ---------------------------------------------------------
    // Adapt semantic codec → raw STSD params (Tier 3)
    // ---------------------------------------------------------
    const stsdIntent = buildStsdIntentFromSemanticTrack({
        codecName:       tracks[1].semanticCore.codec.codec,
        semanticCodec:   tracks[1].semanticCore.codec,
        buildParameters: tracks[1].buildParameters,
        buildHints:      tracks[1].buildHints
    });

    console.log("emitted intent", stsdIntent); 


    const emittedStsdBytes =
        serializeBoxTree(
            EmitterRegistry.assemble(
                "moov/trak/mdia/minf/stbl/stsd",
                stsdIntent
            )
        );

    // ---------------------------------------------------------
    // 7. Extract oracle STSD bytes
    // ---------------------------------------------------------
    const oracleStsdBytes =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4Bytes,
                "moov/trak[1]/mdia/minf/stbl/stsd"
            )
            .readBoxReport()
            .raw;

    // ---------------------------------------------------------
    // 8. Byte-for-byte equivalence
    // ---------------------------------------------------------
    assertEqual(
        "stsd.size",
        emittedStsdBytes.length,
        oracleStsdBytes.length
    );

    for (let i = 0; i < oracleStsdBytes.length; i++) {
        assertEqualHex(
            `stsd.byte[${i}]`,
            emittedStsdBytes[i],
            oracleStsdBytes[i]
        );
    }
}

export async function testNativeMuxer_STSD_CompilerPath_Mp4a_Equals_FFmpegOracle() {

    // ---------------------------------------------------------
    // Load oracle MP4 (AAC)
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Run golden client (authoritative compiler inputs)
    // ---------------------------------------------------------
    const { tracks } = await runGoldenMp4AVTestClient({ mp4Bytes });

    const audioTrack = tracks[1];

    assertExists("audioTrack", audioTrack);
    assertEqual("audio codec", audioTrack.semanticCore.codec.codec.startsWith("mp4a"), true);

    // ---------------------------------------------------------
    // Adapt semantic codec → raw STSD params (Tier 3)
    // ---------------------------------------------------------
    const stsdIntent = buildStsdIntentFromSemanticTrack({
        codecName:       tracks[1].semanticCore.codec.codec,
        semanticCodec:   tracks[1].semanticCore.codec,
        buildParameters: tracks[1].buildParameters,
        buildHints:      tracks[1].buildHints
    });

    const emittedStsdBytes =
        serializeBoxTree(
            EmitterRegistry.assemble(
                "moov/trak/mdia/minf/stbl/stsd",
                stsdIntent
            )
        );

     const emittedStsdExtractor = getGoldenTruthBox.getSemanticBoxDataFromBox({
            boxBytes: emittedStsdBytes,
            sourceRegistryKey: "moov/trak/mdia/minf/stbl/stsd",
            targetBoxPath: "moov/trak/mdia/minf/stbl/stsd",
        })

    // ---------------------------------------------------------
    // Extract oracle STSD bytes
    // ---------------------------------------------------------
    const oracleStsdExtractor = getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4Bytes,
                "moov/trak[1]/mdia/minf/stbl/stsd"
            )


    console.log("oracle stsdIntent", oracleStsdExtractor.getEmitterInput());

    // ---------------------------------------------------------
    // Byte-for-byte equivalence
    // ---------------------------------------------------------

    const diffs = [];

    for (let i = 0; i < oracleStsdExtractor.readBoxReport().raw.length; i++) {
        assertEqualHexCollect(
            diffs,
            `stsd.byte[${i}]`,
            emittedStsdExtractor.readBoxReport().raw[i],
            oracleStsdExtractor.readBoxReport().raw[i]
        );
    }

    if (diffs.length) {
        console.table(diffs);
        throw new Error(`stsd mismatch: ${diffs.length} bytes differ`);
    }

}


export async function testNativeMuxer_STSD_CompilerPath_Avc1_Equals_FFmpegOracle() {

    // ---------------------------------------------------------
    // Load oracle MP4 (AVC + AAC)
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Run golden client (authoritative compiler inputs)
    // ---------------------------------------------------------
    const { tracks } = await runGoldenMp4AVTestClient({ mp4Bytes });

    const videoTrack = tracks[0];

    assertExists("videoTrack", videoTrack);
    assertEqual(
        "video codec startsWith avc1",
        videoTrack.semanticCore.codec.codec.startsWith("avc1"),
        true
    );

    // ---------------------------------------------------------
    // Adapt semantic codec → raw STSD params (Tier 3)
    // ---------------------------------------------------------
    const stsdIntent = buildStsdIntentFromSemanticTrack({
        codecName:       tracks[0].semanticCore.codec.codec,
        semanticCodec:   tracks[0].semanticCore.codec,
        buildParameters: tracks[0].buildParameters,
        buildHints:      tracks[0].buildHints
    });

    const emittedStsdBytes =
        serializeBoxTree(
            EmitterRegistry.assemble(
                "moov/trak/mdia/minf/stbl/stsd",
                stsdIntent
            )
        );

    console.log("tracks[1].semanticCore.codec", tracks[1].semanticCore.codec);
    console.log("stsdIntent", stsdIntent);

    // ---------------------------------------------------------
    // Extract oracle STSD bytes
    // ---------------------------------------------------------
    const oracleStsdBytes =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4Bytes,
                "moov/trak[0]/mdia/minf/stbl/stsd"
            )
 
    console.log("test: oracle intent", oracleStsdBytes.getEmitterInput());
 
    // ---------------------------------------------------------
    // Byte-for-byte equivalence
    // ---------------------------------------------------------
    const diffs = [];

    for (let i = 0; i < oracleStsdBytes.readBoxReport().raw.length; i++) {
        assertEqualHexCollect(
            diffs,
            `stsd.byte[${i}]`,
            emittedStsdBytes[i],
            oracleStsdBytes.readBoxReport().raw[i]
        );
    }

    if (diffs.length) {
        console.table(diffs);
        throw new Error(`avc1 stsd mismatch: ${diffs.length} bytes differ`);
    }
}
