import { adaptSttsFromSamples } from "../adapters/adaptSttsFromSamples.js";
import { assertEqual } from "./assertions.js";

export function testNativeMuxer_AdaptSttsFromSamples_CFR() {

    console.log(
        "=== testNativeMuxer_AdaptSttsFromSamples_CFR ==="
    );

    const samples = [
        { duration: 512 },
        { duration: 512 },
        { duration: 512 }
    ];

    const result = adaptSttsFromSamples({ samples });

    assertEqual("sampleCount", result.sampleCount, 3);
    assertEqual("sampleDuration", result.sampleDuration, 512);

    console.log(
        "PASS: STTS adapter derives constant-duration input"
    );
}

export function testNativeMuxer_AdaptSttsFromSamples_VariableDurationFails() {

    console.log(
        "=== testNativeMuxer_AdaptSttsFromSamples_VariableDurationFails ==="
    );

    const samples = [
        { duration: 512 },
        { duration: 256 }
    ];

    let threw = false;

    try {
        adaptSttsFromSamples({ samples });
    } catch (err) {
        threw = true;
    }

    assertEqual(
        "adapter rejects VFR samples",
        threw,
        true
    );

    console.log(
        "PASS: STTS adapter rejects unsupported variable durations"
    );
}
