import { adaptStszFromSamples } from "../adapters/adaptStszFromSamples.js";
import { assertEqual } from "./assertions.js";

export function testNativeMuxer_AdaptStszFromSamples() {

    console.log(
        "=== testNativeMuxer_AdaptStszFromSamples ==="
    );

    const samples = [
        { bytes: new Uint8Array(10) },
        { bytes: new Uint8Array(20) },
        { bytes: new Uint8Array(5) }
    ];

    const result = adaptStszFromSamples({ samples });

    assertEqual("sizes.length", result.sizes.length, 3);
    assertEqual("sizes[0]", result.sizes[0], 10);
    assertEqual("sizes[1]", result.sizes[1], 20);
    assertEqual("sizes[2]", result.sizes[2], 5);

    console.log(
        "PASS: STSZ adapter derives sizes correctly"
    );
}
