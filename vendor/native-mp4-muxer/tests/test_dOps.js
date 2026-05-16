import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { assertEqual } from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { GoldenTruthRegistry } from "./goldenTruthExtractors/GoldenTruthRegistry.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
import { SampleEntryReader } from "../reference/SampleEntryReader.js";
/**
 * dOps — Opus Decoder Configuration Box
 * ====================================
 *
 * Structural + payload-preservation tests for dOps.
 *
 * dOps is a codec-owned configuration box for Opus-in-MP4.
 * The MP4 container treats its payload as opaque.
 *
 * Test focus:
 * -----------
 * - correct box identity
 * - correct FullBox framing
 * - opaque payload preservation
 *
 * No Opus semantic interpretation is performed.
 */

/**
 * dOps Structural Test
 * -------------------
 *
 * Proves that:
 * - dOps can be emitted via the registry
 * - payload is treated as opaque
 * - no interpretation or mutation occurs
 */
export function testDOps_Structure() {

    const payload = Uint8Array.from([
        0x01,       // version
        0x02,       // channel count
        0x00, 0xF0, // pre-skip
        0x80, 0xBB, 0x00, 0x00, // input sample rate (48000)
        0x00, 0x00, // output gain
        0x00        // channel mapping family
    ]);

    // ---------------------------------------------------------
    // Emit via registry
    // ---------------------------------------------------------
    const node = EmitterRegistry.emit(
        "moov/trak/mdia/minf/stbl/stsd|Opus/dOps",
        {
            payload,
            version: 0,
            flags: 0x000201F8 // example non-binary flags
        }
    );

    // ---------------------------------------------------------
    // Box identity
    // ---------------------------------------------------------
    assertEqual("dOps.type", node.type, "dOps");

    // ---------------------------------------------------------
    // FullBox framing
    // ---------------------------------------------------------
    assertEqual("dOps.version", node.version, 0);
    assertEqual("dOps.flags", typeof node.flags, "number");

    // ---------------------------------------------------------
    // 🔥 CRITICAL: codec-owned opaque flags
    // ---------------------------------------------------------
    assertEqual(
        "dOps.opaqueFlags",
        node.opaqueFlags,
        true
    );

    // ---------------------------------------------------------
    // Payload structure
    // ---------------------------------------------------------
    if (!Array.isArray(node.body)) {
        throw new Error("FAIL: dOps.body must be an array");
    }

    assertEqual("dOps.body.length", node.body.length, 1);

    const field = node.body[0];

    assertEqual("dOps.payload.array", field.array, "byte");
    assertEqual("dOps.payload.length", field.values.length, payload.length);

    // ---------------------------------------------------------
    // Payload preservation
    // ---------------------------------------------------------
    for (let i = 0; i < payload.length; i++) {
        assertEqual(
            `dOps.payload.byte[${i}]`,
            field.values[i],
            payload[i]
        );
    }

    serializeBoxTree(node);

}

/**
 * dOps Locked Layout Equivalence (ffmpeg)
 * --------------------------------------
 *
 * Purpose
 * -------
 * Proves that Framesmith re-emits dOps
 * *exactly* as produced by ffmpeg.
 *
 * This establishes:
 * - demuxer authority over dOps payload
 * - muxer opacity guarantees
 */
export async function testDOps_LockedLayoutEquivalence_ffmpeg() {
    const resp = await fetch("reference/reference_av_opus.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Extract reference dOps
    // ---------------------------------------------------------
    const truth = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4,
        "moov/trak[1]/mdia/minf/stbl/stsd/sample[0]/dOps"
    );

    const refFields = truth.readBoxReport();
    const params    = truth.getEmitterInput();

    // ---------------------------------------------------------
    // Re-emit dOps
    // ---------------------------------------------------------
    const outRaw = serializeBoxTree(
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/stsd|Opus/dOps",
            params
        )
    );

    const oracleDopsRaw = GoldenTruthRegistry.getExtractor("moov/trak/mdia/minf/stbl/stsd|Opus/dOps").readBoxReport(outRaw).raw;

    // ---------------------------------------------------------
    // Absolute byte-for-byte equivalence
    // ---------------------------------------------------------
    assertEqual(
        "dOps.size",
        outRaw.length,
        refFields.raw.length
    );

    for (let i = 0; i < refFields.raw.length; i++) {
        assertEqual(
            `dOps.byte[${i}]`,
            outRaw[i],
            refFields.raw[i]
        );
    }
}

