import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { readUint32 } from "../bytes/mp4ByteReader.js";
import { assertEqual } from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
import { GoldenTruthRegistry } from "./goldenTruthExtractors/GoldenTruthRegistry.js";

export async function testStts_Structure() {

    const fps   = 30;
    const delta = Math.floor(90000 / fps);
    const count = 47;

    const node =
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/stts",
            {
                entries: [
                    {
                        sampleCount: count,
                        sampleDelta: delta
                    }
                ]
            }
        );

    // ---------------------------------------------------------
    // Box identity
    // ---------------------------------------------------------
    assertEqual("stts.type", node.type, "stts");
    assertEqual("stts.version", node.version, 0);
    assertEqual("stts.flags", node.flags, 0);

    // ---------------------------------------------------------
    // Body shape
    // ---------------------------------------------------------
    assertEqual("stts.body.length", node.body.length, 3);

    // ---------------------------------------------------------
    // Entry count
    // ---------------------------------------------------------
    assertEqual(
        "stts.entry_count",
        node.body[0].int,
        1
    );

    // ---------------------------------------------------------
    // Sample count
    // ---------------------------------------------------------
    assertEqual(
        "stts.sample_count",
        node.body[1].int,
        count
    );

    // ---------------------------------------------------------
    // Sample delta
    // ---------------------------------------------------------
    assertEqual(
        "stts.sample_delta",
        node.body[2].int,
        delta
    );
}

/**
 * testStts_Conformance
 * -------------------
 * Phase C test: byte-for-byte comparison against a real MP4
 * produced by ffmpeg.
 *
 * This test proves that Framesmith’s STTS output:
 * - matches real-world encoders exactly
 * - uses the same entry layout
 * - uses the same timing values
 */

export async function testStts_Conformance() {

    // -------------------------------------------------------------
    // 1. Load golden MP4
    // -------------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // -------------------------------------------------------------
    // 2. Read reference STTS via MP4 navigation
    // -------------------------------------------------------------
    const ref = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4,
        "moov/trak[0]/mdia/minf/stbl/stts",
    );

    const refFields = ref.readBoxReport();
    const params    = ref.getEmitterInput();

    // -------------------------------------------------------------
    // 3. Rebuild STTS via Framesmith
    // -------------------------------------------------------------
    const outSttsBytes = serializeBoxTree(
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/stts",
            params
        ),
    );

    // -------------------------------------------------------------
    // 4. Read rebuilt STTS via box entry
    // -------------------------------------------------------------
    const extractor = GoldenTruthRegistry.getExtractor(
            "moov/trak/mdia/minf/stbl/stts",
        );
    const out = extractor.readBoxReport(outSttsBytes);

    // -------------------------------------------------------------
    // 5. Field-level conformance
    // -------------------------------------------------------------
    const outEntries = out.box.fields.entries;
    const refEntries = refFields.box.fields.entries;

    assertEqual(
        "stts.entryCount",
        outEntries.length,
        refEntries.length
    );

    assertEqual(
        "stts.sampleCount",
        outEntries[0].sampleCount,
        refEntries[0].sampleCount
    );

    assertEqual(
        "stts.sampleDelta",
        outEntries[0].sampleDelta,
        refEntries[0].sampleDelta
    );

    // -------------------------------------------------------------
    // 6. Byte-for-byte conformance
    // -------------------------------------------------------------
    const refRaw = refFields.raw;

    assertEqual(
        "stts.size",
        outSttsBytes.length,
        refRaw.length
    );

    for (let i = 0; i < refRaw.length; i++) {
        assertEqual(
            `stts.byte[${i}]`,
            outSttsBytes[i],
            refRaw[i]
        );
    }

}

