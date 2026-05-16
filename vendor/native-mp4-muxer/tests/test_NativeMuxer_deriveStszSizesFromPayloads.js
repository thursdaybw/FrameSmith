import { deriveStszIntentFromPayloads } from "../derivers/deriveStszIntentFromPayloads.js";
import { assertEqual } from "./assertions.js";

export function testNativeMuxer_DeriveStszSizesFromPayloads() {

    // =====================================================
    // Case 1: variable-size samples
    // =====================================================

    {
        const accessUnits = [{}, {}, {}];

        const accessUnitPayloads = [
            new Uint8Array(10),
            new Uint8Array(20),
            new Uint8Array(5)
        ];

        const result = deriveStszIntentFromPayloads({
            accessUnits,
            accessUnitPayloads
        });

        assertEqual("variable.sampleSize", result.sampleSize, 0);
        assertEqual("variable.sampleCount", result.sampleCount, 3);

        assertEqual("variable.sizes.length", result.sizes.length, 3);
        assertEqual("variable.sizes[0]", result.sizes[0], 10);
        assertEqual("variable.sizes[1]", result.sizes[1], 20);
        assertEqual("variable.sizes[2]", result.sizes[2], 5);
    }

    // =====================================================
    // Case 2: constant-size samples
    // =====================================================

    {
        const accessUnits = [{}, {}, {}, {}];

        const accessUnitPayloads = [
            new Uint8Array(240),
            new Uint8Array(240),
            new Uint8Array(240),
            new Uint8Array(240)
        ];

        const result = deriveStszIntentFromPayloads({
            accessUnits,
            accessUnitPayloads
        });

        assertEqual("constant.sampleSize", result.sampleSize, 240);
        assertEqual("constant.sampleCount", result.sampleCount, 4);

        // Constant-size STSZ must not include per-sample sizes
        assertEqual("constant.sizes undefined", result.sizes, undefined);
    }
}
