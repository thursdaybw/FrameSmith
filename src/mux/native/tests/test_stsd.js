import { serializeBoxTree } from "../serializer/serializeBoxTree.js";

import {
    assertEqual,
    assertExists,
    assertEqualHex,
    assertEqualHexCollect,
} from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";

import { SampleEntryReader } from "../reference/SampleEntryReader.js";

import { GoldenTruthRegistry } from "./goldenTruthExtractors/GoldenTruthRegistry.js";

import { 
    normalizeWebCodecsDopsToFfmpegCompact
} from "../normalization/codecs/dOps/normalizeWebCodecsDOpsToMp4Payload.js";

import { decodeFullBoxHeader } from "../box-schema/boxLayoutReaders.js";

export async function testStsd_Structure_SingleAvc1() {

    const avcC = Uint8Array.from([1, 2, 3, 4]);

    // ------------------------------------------------------------
    // 1. Build SampleEntry via assembler
    // ------------------------------------------------------------
    const avc1Node = EmitterRegistry.assemble(
        "moov/trak/mdia/minf/stbl/stsd|avc1",
        {
            width: 1920,
            height: 1080,
            compressorName: "",
            avcC,
            btrt: {
                bufferSizeDB: 0,
                maxBitrate: 31504,
                avgBitrate: 31504
            }
        }
    );

    // ------------------------------------------------------------
    // 2. Build stsd via assembler
    // ------------------------------------------------------------
    const node = EmitterRegistry.assemble(
        "moov/trak/mdia/minf/stbl/stsd",
        {
            sampleEntries: [avc1Node]
        }
    );

    // ------------------------------------------------------------
    // 3. Box identity
    // ------------------------------------------------------------
    assertEqual("stsd.type", node.type, "stsd");
    assertEqual("stsd.version", node.version, 0);
    assertEqual("stsd.flags", node.flags, 0);

    // ------------------------------------------------------------
    // 4. Body layout
    // ------------------------------------------------------------
    assertEqual(
        "stsd.body_is_array",
        Array.isArray(node.body),
        true
    );

    assertEqual("stsd.body.length", node.body.length, 1);

    const entryCount = node.body[0];

    assertExists("stsd.sampleEntryCount", entryCount);
    assertEqual("stsd.sampleEntryCount.int", entryCount.int, 1);

    // ------------------------------------------------------------
    // 5. Children (table entries)
    // ------------------------------------------------------------
    assertEqual(
        "stsd.children_is_array",
        Array.isArray(node.children),
        true
    );

    assertEqual(
        "stsd.children.length",
        node.children.length,
        1
    );

    const child = node.children[0];

    assertEqual("sample_entry.type", child.type, "avc1");
    assertExists("sample_entry.body", child.body);
    assertExists("sample_entry.children", child.children);
}

export async function testStsd_Structure_SingleMp4a() {

    const esds = Uint8Array.from([0x03, 0x19, 0x00, 0x00]);

    // ------------------------------------------------------------
    // 1. Build SampleEntry via assembler
    // ------------------------------------------------------------
    const mp4aNode = EmitterRegistry.assemble(
        "moov/trak/mdia/minf/stbl/stsd|mp4a",
        {
            channelCount: 2,
            sampleSize: 16,
            sampleRate: 48000,
            esds
        }
    );

    // ------------------------------------------------------------
    // 2. Build stsd via assembler
    // ------------------------------------------------------------
    const node = EmitterRegistry.assemble(
        "moov/trak/mdia/minf/stbl/stsd",
        {
            sampleEntries: [mp4aNode]
        }
    );

    // ------------------------------------------------------------
    // 3. Box identity
    // ------------------------------------------------------------
    assertEqual("stsd.type", node.type, "stsd");
    assertEqual("stsd.version", node.version, 0);
    assertEqual("stsd.flags", node.flags, 0);

    // ------------------------------------------------------------
    // 4. entry_count
    // ------------------------------------------------------------
    const entryCount = node.body[0];
    assertEqual("stsd.entry_count", entryCount.int, 1);

    // ------------------------------------------------------------
    // 5. SampleEntry
    // ------------------------------------------------------------
    assertEqual(
        "stsd.children.length",
        node.children.length,
        1
    );

    const child = node.children[0];

    assertEqual("sample_entry.type", child.type, "mp4a");
    assertExists("sample_entry.body", child.body);
    assertExists("sample_entry.children", child.children);
}

export async function testStsd_LockedLayoutEquivalence_ffmpeg() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const truth = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4,
        "moov/trak[0]/mdia/minf/stbl/stsd"
    );

    const refFields = truth.readBoxReport();
    const params    = truth.getEmitterInput();

    // params.sampleEntries is now:
    // Array<fully built SampleEntry nodes>

    const outBytes = serializeBoxTree(
        EmitterRegistry.assemble(
            "moov/trak/mdia/minf/stbl/stsd",
            params,
        )
    );

    const refRaw = refFields.raw;

    for (let i = 0; i < refRaw.length; i++) {
        assertEqualHex(
            `stsd.byte[${i}]`,
            outBytes[i],
            refRaw[i]
        );
    }

    assertEqual(
        "stsd.size",
        outBytes.length,
        refRaw.length
    );

}

export async function testStsd_LockedLayoutEquivalence_ffmpeg_mp4a() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // audio track
    const truth = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4,
        "moov/trak[1]/mdia/minf/stbl/stsd"
    );

    const refFields = truth.readBoxReport();
    const params    = truth.getEmitterInput();

    const outBytes = serializeBoxTree(
        EmitterRegistry.assemble(
            "moov/trak/mdia/minf/stbl/stsd",
            params,
        )
    );

    const refRaw = refFields.raw;

    for (let i = 0; i < refRaw.length; i++) {
        assertEqualHex(
            `stsd.byte[${i}]`,
            outBytes[i],
            refRaw[i]
        );
    }

    assertEqual(
        "stsd.size",
        outBytes.length,
        refRaw.length
    );

}


/**
 * Opus dOps — WebCodecs vs FFmpeg Oracle
 * =====================================
 *
 * Proves that:
 * - WebCodecs supplies a valid OpusHead
 * - WebCodecs dOps payload matches FFmpeg oracle dOps payload
 * - STSD / Opus SampleEntry re-emits dOps without mutation
 *
 * Scope:
 * - semantic input equivalence
 * - container passthrough integrity
 *
 * Non-goals:
 * - no OpusHead parsing
 * - no codec semantics
 * - no policy decisions
 */

async function loadWebCodecsFixtures() {
    const resp = await fetch(
        "./fixtures/webcodecs_opus_av_access_units.json"
    );
    return await resp.json();
}


export async function testStsd_Opus_Dops_WebCodecs_Normalized_Equals_FFmpegOracle() {

    // Load FFmpeg Opus oracle MP4
    const resp = await fetch("reference/reference_av_opus.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const fixtures                = await loadWebCodecsFixtures();
    const webcodecsDops           = new Uint8Array(fixtures[1].dOps);


    // Extract oracle STSD + oracle dOps (RAW BOX BYTES)
    const oracleDopsReport = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(mp4, "moov/trak[1]/mdia/minf/stbl/stsd/sample[0]/dOps").readBoxReport();
    console.table(oracleDopsReport.diagnostics);
    console.table(oracleDopsReport.diagnostics);

    console.table(
        decodeDOpsPayload_Compact7_PayloadOnly(
            "webcodecs normalized decodeDOpsPayload_Compact7_PayloadOnly",
            normalizeWebCodecsDopsToFfmpegCompact(webcodecsDops)
        )
    );

    const emittedStsdNode = EmitterRegistry.assemble( "moov/trak/mdia/minf/stbl/stsd", {
        sampleEntries: [
            EmitterRegistry.assemble(
                "moov/trak/mdia/minf/stbl/stsd|Opus",
                {
                    // SampleEntry
                    reserved1:  0,
                    reserved2:  0,
                    reserved3:  0,
                    reserved4:  0,
                    reserved5:  0,
                    reserved6:  0,
                    dataReferenceIndex: 1,

                    // AudioSampleEntry reserved / pre_defined
                    reserved7: 0,
                    reserved8: 0,

                    // AudioSampleEntry fields
                    channelCount: 2,
                    sampleSize:   16,
                    preDefined1:  0,
                    preDefined2:  0,

                    // sampleRate (16.16)
                    sampleRate: 0xbb800000, // 48000 << 16

                    dOps: {
                        payload: normalizeWebCodecsDopsToFfmpegCompact(webcodecsDops),
                        version: 0,
                        flags: oracleDopsReport.box.header.flags, 
                    },
                    btrt: {
                        bufferSizeDB: 0,
                        maxBitrate: 96000,
                        avgBitrate:96000, 
                    }
                }
            ),
        ]
    }
    );

    const emittedStsdBytes = serializeBoxTree(emittedStsdNode);

    const emittedDopsReport = getGoldenTruthBox.getSemanticBoxDataFromBox({
        boxBytes: emittedStsdBytes,
        sourceRegistryKey: "moov/trak/mdia/minf/stbl/stsd",
        targetBoxPath: "moov/trak/mdia/minf/stbl/stsd/sample[0]/dOps",
    }).readBoxReport();

    console.table(decodeFullBoxHeader("emitted dOps decodeFullBoxHeader", emittedDopsReport.raw));

    const emittedStsdReport = getGoldenTruthBox.getSemanticBoxDataFromBox({
        boxBytes: emittedStsdBytes,
        sourceRegistryKey: "moov/trak/mdia/minf/stbl/stsd",
        targetBoxPath: "moov/trak/mdia/minf/stbl/stsd",
    }).readBoxReport();

    const oracleStsdReport = getGoldenTruthBox.getSemanticBoxDataFromBox({
        boxBytes: mp4,
        sourceRegistryKey: "$mp4",
        targetBoxPath: "moov/trak[1]/mdia/minf/stbl/stsd",
    }).readBoxReport();

    const oracleOpusReport = getGoldenTruthBox.getSemanticBoxDataFromBox({
        boxBytes: oracleStsdReport.raw,
        sourceRegistryKey: "moov/trak/mdia/minf/stbl/stsd",
        targetBoxPath: "moov/trak/mdia/minf/stbl/stsd/sample[0]",
    }).readBoxReport()

    const emittedOpusReport = getGoldenTruthBox.getSemanticBoxDataFromBox({
        boxBytes: emittedStsdBytes,
        sourceRegistryKey: "moov/trak/mdia/minf/stbl/stsd",
        targetBoxPath: "moov/trak/mdia/minf/stbl/stsd/sample[0]",
    }).readBoxReport()

    console.table("emittedOpusReport", emittedOpusReport.diagnostics); 
    console.table("oraceOpusReport", oracleOpusReport.diagnostics); 

    const oracleOpusBtrtReport = getGoldenTruthBox.getSemanticBoxDataFromBox({
        boxBytes: oracleStsdReport.raw,
        sourceRegistryKey: "moov/trak/mdia/minf/stbl/stsd",
        targetBoxPath: "moov/trak/mdia/minf/stbl/stsd/sample[0]/btrt",
    }).readBoxReport()
    console.log("oracleOpusBtrtReport", oracleOpusBtrtReport.diagnostics);

    const diffs = [];

    for (let i = 0; i < oracleStsdReport.raw.length; i++) {
        assertEqualHexCollect(
            diffs,
            `stsd.byte[${i}]`,
            emittedStsdReport.raw[i],
            oracleStsdReport.raw[i]
        );
    }

    if (diffs.length) {
        console.table(diffs);
        throw new Error(`stsd mismatch: ${diffs.length} bytes differ`);
    }

}


function decodeDOpsPayload_Compact7_PayloadOnly(label, payload) {
    if (payload.length !== 7) {
        throw new Error(
            `decodeDOpsPayload_Compact7_PayloadOnly: expected 7 bytes, got ${payload.length}`
        );
    }

    return [
        { label, bytes: "0",   field: "opusVersion", value: payload[0] },
        { label, bytes: "1",   field: "channelCount", value: payload[1] },
        {
            label,
            bytes: "2–3",
            field: "preSkip (uint16 BE)",
            value: (payload[2] << 8) | payload[3],
        },
        {
            label,
            bytes: "4–6",
            field: "inputSampleRate (uint24 BE)",
            value:
            (payload[4] << 16) |
            (payload[5] << 8)  |
            payload[6],
        },
    ];
}
