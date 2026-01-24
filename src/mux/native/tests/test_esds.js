import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { readUint32 } from "../bytes/mp4ByteReader.js";
import { assertEqual, assertExists } from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";

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
export function testEsds_Structure() {

    const payload = Uint8Array.from([
        0x03, 0x19, 0x00, 0x02, 0x00,  // fake ES_Descriptor
        0x04, 0x11, 0x40, 0x15, 0x00,
        0x06, 0x00, 0x00, 0x00, 0x02,
        0x05, 0x02, 0x11, 0x90       // fake AudioSpecificConfig
    ]);

    // ---------------------------------------------------------
    // Emit via registry (not direct emitter)
    // ---------------------------------------------------------
    const node = EmitterRegistry.emit(
        "moov/trak/mdia/minf/stbl/stsd|mp4a/esds",
        { esds: payload }
    );

    // ---------------------------------------------------------
    // Box identity
    // ---------------------------------------------------------
    assertEqual("esds.type", node.type, "esds");

    // ---------------------------------------------------------
    // Body structure
    // ---------------------------------------------------------
    if (!Array.isArray(node.body)) {
        throw new Error("FAIL: esds.body must be an array");
    }

    assertEqual("esds.body.length", node.body.length, 1);

    const entry = node.body[0];

    if (!Array.isArray(entry.values)) {
        throw new Error("FAIL: esds payload must be emitted as an opaque byte array");
    }

    // ---------------------------------------------------------
    // Payload preservation (structural, not byte-encoded)
    // ---------------------------------------------------------
    assertEqual(
        "esds.payload.length",
        entry.values.length,
        payload.length
    );

    for (let i = 0; i < payload.length; i++) {
        assertEqual(
            `esds.payload.byte[${i}]`,
            entry.values[i],
            payload[i]
        );
    }
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

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const truth = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4,
        "moov/trak[1]/mdia/minf/stbl/stsd/sample[0]/esds",
    );

    const refFields = truth.readBoxReport();
    const params    = truth.getEmitterInput();

    const outRaw = serializeBoxTree(
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/stsd|mp4a/esds",
            params, 
        )
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

}
