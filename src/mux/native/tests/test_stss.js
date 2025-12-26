import { emitStssBox } from "../box-emitters/stssBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { assertEqual } from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

export async function testStss_Structure() {

    console.log("=== testStss_Structure ===");

    // ---------------------------------------------------------
    // TEST 1: empty sync sample list
    // ---------------------------------------------------------
    let input = [];
    let node  = emitStssBox({ sampleNumbers: input });

    assertEqual("stss.type", node.type, "stss");
    assertEqual("stss.version", node.version, 0);
    assertEqual("stss.flags", node.flags, 0);

    assertEqual(
        "stss.body_is_array",
        Array.isArray(node.body),
        true
    );

    // entry_count + array wrapper
    assertEqual(
        "stss.body.length",
        node.body.length,
        2
    );

    assertEqual(
        "stss.entry_count",
        node.body[0].int,
        0
    );

    assertEqual(
        "stss.samples_array_type",
        node.body[1].array,
        "int"
    );

    assertEqual(
        "stss.samples_array_empty",
        node.body[1].values.length,
        0
    );

    // ---------------------------------------------------------
    // TEST 2: single sync sample
    // ---------------------------------------------------------
    input = [1];
    node  = emitStssBox({ sampleNumbers: input });

    assertEqual("stss.entry_count", node.body[0].int, 1);
    assertEqual("stss.samples.length", node.body[1].values.length, 1);
    assertEqual("stss.samples[0]", node.body[1].values[0], 1);

    // ---------------------------------------------------------
    // TEST 3: multiple sync samples
    // ---------------------------------------------------------
    const samples = [1, 10, 25];
    node = emitStssBox({ sampleNumbers: samples });

    assertEqual(
        "stss.entry_count",
        node.body[0].int,
        samples.length
    );

    assertEqual(
        "stss.samples.length",
        node.body[1].values.length,
        samples.length
    );

    for (let i = 0; i < samples.length; i++) {
        assertEqual(
            `stss.samples[${i}]`,
            node.body[1].values[i],
            samples[i]
        );
    }

    // ---------------------------------------------------------
    // TEST 4: immutability
    // ---------------------------------------------------------
    const mutable = [3, 7, 11];
    node = emitStssBox({ sampleNumbers: mutable });

    mutable[0] = 999;

    assertEqual(
        "stss.immutability",
        node.body[1].values[0],
        3
    );

    console.log("PASS: stss structural correctness");
}
export async function testStss_LockedLayoutEquivalence_ffmpeg() {

    console.log(
        "=== testStss_LockedLayoutEquivalence_ffmpeg (golden MP4) ==="
    );

    // ---------------------------------------------------------
    // 1. Load golden MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Parse reference STSS via parser registry
    // ---------------------------------------------------------
    const ref = getGoldenTruthBox.fromMp4(
        mp4,
        "moov/trak/mdia/minf/stbl/stss"
    );

    const refFields = ref.readFields();
    const buildParams = ref.getBuilderInput();

    // ---------------------------------------------------------
    // 3. Rebuild STSS via Framesmith
    // ---------------------------------------------------------
    const outBytes = serializeBoxTree(
        emitStssBox(buildParams)
    );

    // ---------------------------------------------------------
    // 4. Byte-for-byte equivalence
    // ---------------------------------------------------------
    const refRaw = refFields.raw;

    assertEqual("stss.size", outBytes.length, refRaw.length);

    for (let i = 0; i < refRaw.length; i++) {
        assertEqual(
            `stss.byte[${i}]`,
            outBytes[i],
            refRaw[i]
        );
    }

    console.log(
        "PASS: stss parser rebuilds ffmpeg output byte-for-byte"
    );
}
