import { emitStsdBox } from "../box-emitters/stsdBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { readUint16, readUint32, readFourCC } from "../bytes/mp4ByteReader.js";
import { extractBoxByPathFromMp4 } from "./reference/BoxExtractor.js";
import { assertEqual, assertExists } from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

export async function testStsd_Structure() {

    console.log("=== testStsd_Structure (Phase A) ===");

    const width  = 1920;
    const height = 1080;

    const avcC = Uint8Array.from([1, 2, 3, 4]);

    const btrt = {
        bufferSizeDB: 0,
        maxBitrate: 31504,
        avgBitrate: 31504
    };

    const node = emitStsdBox({
        width,
        height,
        codec: "avc1",
        avcC,
        compressorName: "",
        btrt
    });

    // ------------------------------------------------------------
    // 1. Box identity
    // ------------------------------------------------------------
    assertEqual("stsd.type", node.type, "stsd");
    assertEqual("stsd.version", node.version, 0);
    assertEqual("stsd.flags", node.flags, 0);

    // ------------------------------------------------------------
    // 2. Body layout
    // ------------------------------------------------------------
    assertEqual("stsd.body_is_array", Array.isArray(node.body), true);
    assertEqual("stsd.body.length", node.body.length, 1);

    assertEqual("stsd.children_is_array", Array.isArray(node.children), true);
    assertEqual("stsd.children.length", node.children.length, 1);

    assertEqual(
        "stsd.child.type",
        node.children[0].type,
        "avc1"
    );

    // ------------------------------------------------------------
    // 3. entry_count
    // ------------------------------------------------------------
    const entryCount = node.body[0];

    assertEqual(
        "stsd.entry_count.is_int",
        "int" in entryCount,
        true
    );

    assertEqual(
        "stsd.entry_count",
        entryCount.int,
        1
    );

    // ------------------------------------------------------------
    // 4. Sample entry (avc1)
    // ------------------------------------------------------------
    const sampleEntry = node.children[0];

    assertEqual(
        "stsd.sample_entry_is_object",
        typeof sampleEntry === "object" && sampleEntry !== null,
        true
    );

    assertEqual(
        "stsd.sample_entry.type",
        sampleEntry.type,
        "avc1"
    );

    assertEqual(
        "avc1.body_is_array",
        Array.isArray(sampleEntry.body),
        true
    );

    // ------------------------------------------------------------
    // 5. Child boxes must exist
    // ------------------------------------------------------------
    assertEqual(
        "avc1.children_is_array",
        Array.isArray(sampleEntry.children),
        true
    );

    const childTypes = sampleEntry.children.map(b => b.type);

    for (const required of ["avcC", "pasp", "btrt"]) {
        assertEqual(
            `avc1.child_present.${required}`,
            childTypes.includes(required),
            true
        );
    }

    // ------------------------------------------------------------
    // 6. Immutability
    // ------------------------------------------------------------
    avcC[0] = 99;

    const avcCBox = sampleEntry.children.find(b => b.type === "avcC");
    assertExists("avcC.box", avcCBox);

    assertEqual(
        "avcC.immutability",
        avcCBox.body[0].array?.values?.[0] !== 99,
        true
    );

    console.log("PASS: stsd Phase A structural correctness");
}

export async function testStsd_GoldenTruthExtractor() {
    console.log("=== testStsd_GoldenTruthExtractor ===");

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const parsed = getGoldenTruthBox.fromMp4(
        mp4,
        "moov/trak/mdia/minf/stbl/stsd"
    );

    const fields = parsed.readFields();
    const input  = parsed.getBuilderInput();

    assertEqual("stsd.entryCount", fields.entryCount, 1);

    assertEqual("stsd.codec", input.codec, "avc1");
    assertExists("stsd.width", input.width);
    assertExists("stsd.height", input.height);
    assertExists("stsd.avcC", input.avcC);
    assertExists("stsd.btrt", input.btrt);

    console.log("PASS: stsd golden truth extractor");
}

export async function testStsd_LockedLayoutEquivalence_ffmpeg() {

    console.log(
        "=== testStsd_LockedLayoutEquivalence_ffmpeg ==="
    );

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const parsed = getGoldenTruthBox.fromMp4(
        mp4,
        "moov/trak/mdia/minf/stbl/stsd"
    );

    const buildParams = parsed.getBuilderInput();

    const outBytes = serializeBoxTree(
        emitStsdBox(buildParams)
    );

    const refBytes = extractBoxByPathFromMp4(
        mp4,
        "moov/trak/mdia/minf/stbl/stsd"
    );

    assertEqual("stsd.size", outBytes.length, refBytes.length);

    for (let i = 0; i < refBytes.length; i++) {
        assertEqual(
            `stsd.byte[${i}]`,
            outBytes[i],
            refBytes[i]
        );
    }

    console.log(
        "PASS: stsd parser rebuilds ffmpeg output byte-for-byte"
    );
}
