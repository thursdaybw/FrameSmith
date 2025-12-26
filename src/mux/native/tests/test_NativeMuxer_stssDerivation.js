import { deriveStssSampleNumbers } from "../deriveStssSampleNumbers.js";
import { assertEqual } from "./assertions.js";

export function testNativeMuxer_DeriveStssSampleNumbers_Simple() {

    console.log(
        "=== testNativeMuxer_DeriveStssSampleNumbers_Simple ==="
    );

    const samples = [
        { isKey: true  }, // 1
        { isKey: false }, // 2
        { isKey: false }, // 3
        { isKey: true  }, // 4
        { isKey: false }, // 5
        { isKey: true  }  // 6
    ];

    const syncSamples = deriveStssSampleNumbers({ samples });

    assertEqual("stss[0]", syncSamples[0], 1);
    assertEqual("stss[1]", syncSamples[1], 4);
    assertEqual("stss[2]", syncSamples[2], 6);
    assertEqual("stss.count", syncSamples.length, 3);

    console.log(
        "PASS: STSS derivation (sync sample numbers)"
    );
}
