import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import {
    assertEqual,
    assertExists,
    assertEqualHex,
} from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
//import { emitStsdBox } from "../box-emitters/stsdBox.js";

import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";

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

