import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { assertEqual } from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";

export async function testStss_Structure() {

    // ---------------------------------------------------------
    // TEST 1: empty sync sample list
    // ---------------------------------------------------------
    const input = [];

    const emptySampleListNode =
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/stss",
            { sampleNumbers: input }
        );

    assertEqual("stss.type", emptySampleListNode.type, "stss");
    assertEqual("stss.version", emptySampleListNode.version, 0);
    assertEqual("stss.flags", emptySampleListNode.flags, 0);

    assertEqual(
        "stss.body_is_array",
        Array.isArray(emptySampleListNode.body),
        true
    );

    assertEqual(
        "stss.body.length",
        emptySampleListNode.body.length,
        2
    );

    assertEqual(
        "stss.entry_count",
        emptySampleListNode.body[0].int,
        0
    );

    assertEqual(
        "stss.samples_array_type",
        emptySampleListNode.body[1].array,
        "int"
    );

    assertEqual(
        "stss.samples_array_empty",
        emptySampleListNode.body[1].values.length,
        0
    );
}

export async function testStss_LockedLayoutEquivalence_ffmpeg() {

    // ---------------------------------------------------------
    // 1. Load golden MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Parse reference STSS via parser registry
    // ---------------------------------------------------------
    const ref = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4,
        "moov/trak[0]/mdia/minf/stbl/stss",
    );

    const refFields = ref.readBoxReport();
    const buildParams = ref.getEmitterInput();

    // ---------------------------------------------------------
    // 3. Rebuild STSS via Framesmith
    // ---------------------------------------------------------
    const outBytes = serializeBoxTree(
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/stss",
            buildParams 
        )
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

}

export async function testStss_LockedLayoutEquivalence_ffmpeg_audio() {

    // ---------------------------------------------------------
    // 1. Load golden MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Parse reference STSS on Video track 
    // ---------------------------------------------------------
    let threw = false; 
    try {
        const ref = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]/mdia/minf/stbl/stss",
        );
    } catch {
        threw = true;
    }

    assertEqual("stss found", threw, false);

    // ---------------------------------------------------------
    // Parse reference STSS on audio track
    // ---------------------------------------------------------
    threw = false; 
    try {
        const ref = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[1]/mdia/minf/stbl/stss",
        );
    } catch {
        threw = true;
    }

    assertEqual("stss not found", threw, true);


}
