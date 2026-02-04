import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { readUint16, readUint32 } from "../bytes/mp4ByteReader.js";
import { assertEqual, assertEqualHex } from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { makeFixed1616 } from "../bytes/mp4NumericFormats.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
import { GoldenTruthRegistry } from "./goldenTruthExtractors/GoldenTruthRegistry.js";

/**
 * mp4a — Audio Sample Entry
 * ========================
 *
 * Structural + declared-metadata tests for mp4a.
 *
 * mp4a is an ISO SampleEntry whose semantics belong to the codec.
 * The muxer owns structure only.
 *
 * Test focus:
 * -----------
 * - correct SampleEntry framing
 * - correct audio fields
 * - correct esds containment
 * - byte-for-byte equivalence with ffmpeg
 *
 * No audio decoding semantics are tested.
 */

export async function testMp4a_Structure() {

    const channelCount = 2;
    const sampleSize  = 16;
    const sampleRate  = 48000;

    const esds = Uint8Array.from([
        0x03, 0x19, 0x00, 0x00, 0x00,
        0x04, 0x11, 0x40, 0x15, 0x00,
        0x06, 0x00, 0x00, 0xda, 0xc0,
        0x05, 0x02, 0x11, 0x90,
        0x06, 0x01, 0x02
    ]);

    // ---------------------------------------------------------
    // 1. Build mp4a node (registry only, NO SERIALIZATION)
    // ---------------------------------------------------------
    const node = EmitterRegistry.assemble(
        "moov/trak/mdia/minf/stbl/stsd|mp4a",
        {
            channelCount,
            sampleSize,
            sampleRate,
            esds
        }
    );

    // ---------------------------------------------------------
    // 2. Box identity
    // ---------------------------------------------------------
    assertEqual("mp4a.type", node.type, "mp4a");

    // ---------------------------------------------------------
    // 3. Body structure (AudioSampleEntry preamble)
    // ---------------------------------------------------------
    assertEqual("mp4a.body.isArray", Array.isArray(node.body), true);
    assertEqual("mp4a.body.length", node.body.length, 14);

    // ---------------------------------------------------------
    // 4. Children structure
    // ---------------------------------------------------------
    assertEqual("mp4a.children.isArray", Array.isArray(node.children), true);

    const esdsNode = node.children.find(c => c.type === "esds");

    assertEqual(
        "mp4a.esds.present",
        Boolean(esdsNode),
        true
    );

    assertEqual(
        "mp4a.esds.isFullBox",
        typeof esdsNode.version === "number" &&
        typeof esdsNode.flags === "number",
        true
    );

    assertEqual(
        "mp4a.esds.body.isArray",
        Array.isArray(esdsNode.body),
        true
    );

    assertEqual(
        "mp4a.esds.body.length",
        esdsNode.body.length,
        1
    );

    const esdsField = esdsNode.body[0];

    assertEqual(
        "mp4a.esds.payload.isByteArray",
        esdsField.array === "byte",
        true
    );

    assertEqual(
        "mp4a.esds.payload.length",
        esdsField.values.length,
        esds.length
    );
}

export async function testMp4a_DeclaredMetadata_LockedLayoutEquivalence_ffmpeg() {

    // ---------------------------------------------------------
    // 1. Load golden MP4 (AV)
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Parse reference mp4a
    // ---------------------------------------------------------
    const refParsed = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4,
        "moov/trak[1]/mdia/minf/stbl/stsd/sample[0]"
    );

    const ref         = refParsed.readBoxReport();
    const buildParams = refParsed.getEmitterInput();
    const refRaw      = ref.raw;

    // ---------------------------------------------------------
    // 3. Rebuild mp4a
    // ---------------------------------------------------------
    const mp4aNode = EmitterRegistry.assemble(
            "moov/trak/mdia/minf/stbl/stsd|mp4a",
            buildParams,
        )
    //console.log('mp4aNode', mp4aNode);
    const outBytes = serializeBoxTree(mp4aNode);

    // ---------------------------------------------------------
    // 4. Re-parse rebuilt mp4a
    // ---------------------------------------------------------
    const extractor = GoldenTruthRegistry.getExtractor(
            "moov/trak/mdia/minf/stbl/stsd|mp4a",
        );
    const out = extractor.readBoxReport(outBytes);

    // ---------------------------------------------------------
    // 5. Declared metadata equivalence (box)
    // ---------------------------------------------------------
    assertEqual(
        "mp4a.channelCount",
        out.box.channelCount,
        ref.box.channelCount
    );

    assertEqual(
        "mp4a.sampleSize",
        out.box.sampleSize,
        ref.box.sampleSize
    );

    assertEqual(
        "mp4a.sampleRate",
        out.box.sampleRate,
        ref.box.sampleRate
    );

    // ---------------------------------------------------------
    // 6. Opaque payload preservation (derived)
    // ---------------------------------------------------------
    const refEsds = ref.derived.esds;
    const outEsds = out.derived.esds;

    assertEqual(
        "mp4a.esds.present",
        Boolean(outEsds),
        true
    );

    assertEqual(
        "mp4a.esds.length",
        outEsds.length,
        refEsds.length
    );

    for (let i = 0; i < refEsds.length; i++) {
        assertEqual(
            `mp4a.esds.byte[${i}]`,
            outEsds[i],
            refEsds[i]
        );
    }

    // ---------------------------------------------------------
    // 7. Absolute locked-layout equivalence (raw)
    // ---------------------------------------------------------
    assertEqual(
        "mp4a.size",
        outBytes.length,
        refRaw.length
    );

    for (let i = 0; i < refRaw.length; i++) {
        assertEqual(
            `mp4a.byte[${i}]`,
            outBytes[i],
            refRaw[i]
        );
    }
}
