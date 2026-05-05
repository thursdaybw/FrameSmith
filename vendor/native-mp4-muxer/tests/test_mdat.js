import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { readUint32 } from "../bytes/mp4ByteReader.js";
import { readFourCC } from "../box-schema/boxLayoutReaders.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { assertEqual, assertEqualHex } from "./assertions.js";

export function testMdat_Structure() {

    // ---------------------------------------------------------
    // 1. Deterministic payload
    // ---------------------------------------------------------
    const payload = new Uint8Array([
        0x01, 0x02, 0x03, 0x04,
        0xaa, 0xbb, 0xcc, 0xdd
    ]);

    // ---------------------------------------------------------
    // 2. Emit via registry + serialize
    // ---------------------------------------------------------
    const node =
        EmitterRegistry.emit(
            "mdat",
            { payload }
        );

    const box = serializeBoxTree(node);

    // ---------------------------------------------------------
    // 3. Box header
    // ---------------------------------------------------------
    assertEqual(
        "mdat.type",
        readFourCC(box, 4),
        "mdat"
    );

    assertEqual(
        "mdat.size",
        readUint32(box, 0),
        box.length
    );

    // ---------------------------------------------------------
    // 4. Header size invariant
    // ---------------------------------------------------------
    const headerSize = 8;

    assertEqual(
        "mdat.headerSize",
        headerSize,
        8
    );

    // ---------------------------------------------------------
    // 5. Payload length
    // ---------------------------------------------------------
    assertEqual(
        "mdat.payload.length",
        box.length - headerSize,
        payload.length
    );

    // ---------------------------------------------------------
    // 6. Payload passthrough (byte-for-byte)
    // ---------------------------------------------------------
    for (let i = 0; i < payload.length; i++) {
        assertEqualHex(
            `mdat.payload.byte[${i}]`,
            box[headerSize + i],
            payload[i]
        );
    }

    // ---------------------------------------------------------
    // 7. No trailing bytes
    // ---------------------------------------------------------
    assertEqual(
        "mdat.trailing_bytes",
        headerSize + payload.length,
        box.length
    );
}



/**
 * testMdat_LockedLayoutEquivalence_ffmpeg
 *
 * Proves:
 * - mdat payload is serialized verbatim
 * - header + payload layout matches ffmpeg output byte-for-byte
 *
 * This is intentionally a byte-level test.
 */

export async function testMdat_LockedLayoutEquivalence_ffmpeg() {

    // ---------------------------------------------------------
    // Load oracle MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Extract mdat truth
    // ---------------------------------------------------------
    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "mdat"
        );

    const read = truth.readBoxReport();
    const raw  = read.raw;

    // ---------------------------------------------------------
    // Emit canonical mdat
    // ---------------------------------------------------------
    const input = truth.getEmitterInput(); // { payload }

    const node =
        EmitterRegistry.emit(
            "mdat",
            input
        );

    const out = serializeBoxTree(node);

    // ---------------------------------------------------------
    // Byte-for-byte equivalence
    // ---------------------------------------------------------
    if (out.length !== raw.length) {
        throw new Error(
            `mdat size mismatch: expected ${raw.length}, got ${out.length}`
        );
    }

    for (let i = 0; i < raw.length; i++) {
        assertEqualHex(
            `mdat.byte[${i}]`,
            out[i],
            raw[i]
        );
    }
}
