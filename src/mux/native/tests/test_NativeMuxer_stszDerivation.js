import { deriveStszSizes } from "../deriveStszSizes.js";
import { assertEqual } from "./assertions.js";

export function testNativeMuxer_DeriveStszSizes_Simple() {

    console.log(
        "=== testNativeMuxer_DeriveStszSizes_Simple ==="
    );

    const samples = [
        { bytes: new Uint8Array(10) },
        { bytes: new Uint8Array(20) },
        { bytes: new Uint8Array(30) }
    ];

    const sizes = deriveStszSizes({ samples });

    assertEqual("stsz.count", sizes.length, 3);
    assertEqual("stsz[0]", sizes[0], 10);
    assertEqual("stsz[1]", sizes[1], 20);
    assertEqual("stsz[2]", sizes[2], 30);

    console.log(
        "PASS: STSZ derivation (per-sample sizes)"
    );
}
