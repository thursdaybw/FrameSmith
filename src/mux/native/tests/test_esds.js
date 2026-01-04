import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { emitEsdsBox } from "../box-emitters/stsdBox/esdsBox.js";
import { readUint32, readFourCC } from "../bytes/mp4ByteReader.js";
import { assertEqual, assertExists } from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

/**
 * esds Structural (Granular) Test
 * -------------------------------
 *
 * Purpose
 * -------
 * Verifies that emitEsdsBox():
 *   - emits a valid MP4 box header
 *   - wraps an opaque descriptor payload
 *   - does not interpret or mutate payload bytes
 *
 * This test uses a synthetic payload.
 * No real codec semantics are involved.
 */
export function testEsds_Structure() {
    console.log("=== esds Granular structural tests ===");

    const payload = Uint8Array.from([
        0x03, 0x19, 0x00, 0x02, 0x00,  // fake ES_Descriptor
        0x04, 0x11, 0x40, 0x15, 0x00,
        0x06, 0x00, 0x00, 0x00, 0x02,
        0x05, 0x02, 0x11, 0x90       // fake AudioSpecificConfig
    ]);

    const box = serializeBoxTree(
        emitEsdsBox({ esds: payload })
    );

    // ---------------------------------------------------------
    // Box header
    // ---------------------------------------------------------
    assertEqual(
        "esds.size field",
        readUint32(box, 0),
        box.length
    );

    assertEqual(
        "esds.type",
        readFourCC(box, 4),
        "esds"
    );

    // ---------------------------------------------------------
    // FullBox header (version + flags)
    // ---------------------------------------------------------
    assertEqual("esds.version", box[8], 0);
    assertEqual("esds.flags",   (box[9] | box[10] | box[11]), 0);

    // ---------------------------------------------------------
    // Payload preservation
    // ---------------------------------------------------------
    const payloadOffset = 12;

    assertEqual(
        "esds.payload.length",
        box.length - payloadOffset,
        payload.length
    );

    for (let i = 0; i < payload.length; i++) {
        assertEqual(
            `esds.payload.byte[${i}]`,
            box[payloadOffset + i],
            payload[i]
        );
    }

    console.log("PASS: esds granular structural correctness");
}

/**
 * esds Golden Truth Extractor Test
 * --------------------------------
 *
 * Purpose
 * -------
 * Proves that the golden truth extractor:
 *   - locates esds correctly in a real MP4
 *   - exposes raw esds bytes
 *   - does NOT interpret descriptor structure
 *
 * This establishes demuxer authority over esds payload.
 */
export async function testEsds_GoldenTruthExtractor() {
    console.log("=== testEsds_GoldenTruthExtractor ===");

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const parsed = getGoldenTruthBox.fromMp4(
        mp4,
        "moov/trak/mdia/minf/stbl/stsd",
        {
            trackType: "audio",
            sampleEntry: "mp4a",
            child: "esds"
        }
    );
    const fields = parsed.readFields();

    assertExists("esds.raw", fields.raw);
    assertEqual("esds.type", readFourCC(fields.raw, 4), "esds");

    console.log("PASS: esds golden truth extractor");
}

/**
 * esds Locked Layout Equivalence (ffmpeg)
 * ---------------------------------------
 *
 * Purpose
 * -------
 * Proves that Framesmith re-emits esds
 * *exactly* as produced by ffmpeg.
 *
 * This is the entire semantic contract of esds.
 */
export async function testEsds_LockedLayoutEquivalence_ffmpeg() {
    console.log("=== testEsds_LockedLayoutEquivalence_ffmpeg ===");

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const truth = getGoldenTruthBox.fromMp4(
        mp4,
        "moov/trak/mdia/minf/stbl/stsd",
        {
            sampleEntry: "mp4a",
            trackType: "audio",
            child: "esds"
        }
    );

    const refFields = truth.readFields();
    const params    = truth.getBuilderInput();

    const outRaw = serializeBoxTree(
        emitEsdsBox(params)
    );

    assertEqual(
        "esds.size",
        outRaw.length,
        refFields.raw.length
    );

    for (let i = 0; i < refFields.raw.length; i++) {
        assertEqual(
            `esds.byte[${i}]`,
            outRaw[i],
            refFields.raw[i]
        );
    }

    console.log("PASS: esds matches ffmpeg byte-for-byte");
}
