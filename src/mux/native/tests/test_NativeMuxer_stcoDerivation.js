import { deriveStcoOffsets } from "../deriveStcoOffsets.js";
import { assertEqual } from "./assertions.js";

export function testNativeMuxer_DeriveStcoOffsets_Simple() {

    console.log(
        "=== testNativeMuxer_DeriveStcoOffsets_Simple ==="
    );

    // ---------------------------------------------------------
    // Canonical samples (byte size only matters)
    // ---------------------------------------------------------
    const s1 = { bytes: new Uint8Array(10) };
    const s2 = { bytes: new Uint8Array(20) };
    const s3 = { bytes: new Uint8Array(30) };

    // ---------------------------------------------------------
    // Canonical chunks
    // ---------------------------------------------------------
    const chunks = [
        { samples: [s1, s2] }, // total = 30 bytes
        { samples: [s3] }      // total = 30 bytes
    ];

    // ---------------------------------------------------------
    // Assume mdat payload starts at byte 100
    // ---------------------------------------------------------
    const mdatDataOffset = 100;

    // ---------------------------------------------------------
    // Execute derivation
    // ---------------------------------------------------------
    const offsets = deriveStcoOffsets({
        chunks,
        mdatDataOffset
    });

    // ---------------------------------------------------------
    // Assertions
    // ---------------------------------------------------------
    assertEqual("stco.entry.count", offsets.length, 2);

    assertEqual("stco.offset[0]", offsets[0], 100);
    assertEqual("stco.offset[1]", offsets[1], 130);

    console.log(
        "PASS: STCO offsets derived correctly"
    );
}
