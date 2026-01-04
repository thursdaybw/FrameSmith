import { adaptStszSizesFromPayloads }  from "../adapters/adaptStszSizesFromPayloads.js";

import { assertEqual } from "./assertions.js";

export function testNativeMuxer_DeriveStszSizesFromPayloads() {

    console.log(
        "=== testNativeMuxer_DeriveStszSizesFromPayloads ==="
    );

    const accessUnits = [{}, {}, {}];

    const accessUnitPayloads = [
        new Uint8Array(10),
        new Uint8Array(20),
        new Uint8Array(5)
    ];

    const result = adaptStszSizesFromPayloads({
        accessUnits,
        accessUnitPayloads
    });

    assertEqual("sizes.length", result.sizes.length, 3);
    assertEqual("sizes[0]", result.sizes[0], 10);
    assertEqual("sizes[1]", result.sizes[1], 20);
    assertEqual("sizes[2]", result.sizes[2], 5);

    console.log(
        "PASS: STSZ sizes derived from payloads correctly"
    );
}
