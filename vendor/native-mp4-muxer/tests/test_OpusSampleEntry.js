import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { readUint16BE, readUint32BE } from "../bytes/mp4ByteReader.js";
import { assertEqual, assertExists } from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
import { GoldenTruthRegistry } from "./goldenTruthExtractors/GoldenTruthRegistry.js";
import { getSampleEntrySchemaByType } from "../reference/SampleEntryReader.js"
import { getBoxSchemaForPath } from "../box-schema/boxSchemas.js"

/**
 * Opus SampleEntry (Opus)
 * ======================
 *
 * Structural + locked-layout tests for Opus SampleEntry.
 *
 * Scope:
 * ------
 * - SampleEntry framing
 * - Fixed fields
 * - Child box wiring (dOps, btrt optional)
 *
 * Non-goals:
 * ----------
 * - No Opus codec semantics
 * - No payload interpretation
 */

/**
 * Opus SampleEntry Structural Test
 * --------------------------------
 *
 * Proves:
 * - Opus SampleEntry can be emitted
 * - Fixed AudioSampleEntry fields are present
 * - Child boxes are preserved structurally
 */
export function testOpusSampleEntry_Structure() {

    const payload = Uint8Array.from([
        0x01, 0x02, 0x00, 0xF0,
        0x80, 0xBB, 0x00, 0x00,
        0x00, 0x00, 0x00
    ]);

    // ---------------------------------------------------------
    // Assemble using EXACT schema field names only
    // ---------------------------------------------------------
    const intent = {
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
            payload,
            version: 0,
            flags: 0
        }
    };

    const node = EmitterRegistry.assemble(
        "moov/trak/mdia/minf/stbl/stsd|Opus",
        intent
    );

    // ---------------------------------------------------------
    // Assert no undeclared fields leaked through
    // ---------------------------------------------------------
    const declaredFieldNames = Object.keys(
        getBoxSchemaForPath(
            "moov/trak/mdia/minf/stbl/stsd|Opus"
        ).fields
    );

    for (const key of Object.keys(intent)) {
        if (key === "dOps") continue;

        if (!declaredFieldNames.includes(key)) {
            throw new Error(
                `[Opus.Structure] Undeclared field '${key}' accepted by assembler/emitter`
            );
        }
    }

    // ---------------------------------------------------------
    // Identity
    // ---------------------------------------------------------
    assertEqual("Opus.type", node.type, "Opus");

    // ---------------------------------------------------------
    // Body + children
    // ---------------------------------------------------------
    assertExists("Opus.body", node.body);
    assertExists("Opus.children", node.children);

    assertEqual("Opus.children.length", node.children.length, 1);
    assertEqual("Opus.children[0].type", node.children[0].type, "dOps");

    // ---------------------------------------------------------
    // DSL validity
    // ---------------------------------------------------------
    serializeBoxTree(node);
}

/**
 * Opus SampleEntry Locked Layout Equivalence (ffmpeg)
 * --------------------------------------------------
 *
 * Proves Framesmith re-emits Opus SampleEntry
 * byte-for-byte identical to ffmpeg output.
 */
export async function testOpusSampleEntry_LockedLayoutEquivalence_ffmpeg() {

    const resp = await fetch("reference/reference_av_opus.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const truth = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4,
        "moov/trak[1]/mdia/minf/stbl/stsd/sample[0]"
    );

    const refFields = truth.readBoxReport();
    const params    = truth.getEmitterInput();

    const opusNode = EmitterRegistry.assemble(
        "moov/trak/mdia/minf/stbl/stsd|Opus",
        params
    )

    const outRaw = serializeBoxTree(opusNode);

    const extractor = GoldenTruthRegistry.getExtractor(
            "moov/trak/mdia/minf/stbl/stsd|Opus",
        );
    const out = extractor.readBoxReport(outRaw);

    for (let i = 0; i < refFields.raw.length; i++) {
        assertEqual(
            `Opus.byte[${i}]`,
            outRaw[i],
            refFields.raw[i]
        );
    }

    assertEqual(
        "Opus.size",
        outRaw.length,
        refFields.raw.length
    );

}


