import { emitMdatBox } from "../box-emitters/mdatBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { readUint32, readFourCC } from "../bytes/mp4ByteReader.js";
import { assertEqual, assertEqualHex } from "./assertions.js";

export function testMdat_Structure() {

    console.log("=== testMdat_Structure ===");

    // ---------------------------------------------------------
    // 1. Deterministic payload
    // ---------------------------------------------------------
    const payload = new Uint8Array([
        0x01, 0x02, 0x03, 0x04,
        0xaa, 0xbb, 0xcc, 0xdd
    ]);

    // ---------------------------------------------------------
    // 2. Emit + serialize
    // ---------------------------------------------------------
    const node = emitMdatBox({ payload });
    const box  = serializeBoxTree(node);

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

    console.log(
        "PASS: mdat structural correctness"
    );
}
