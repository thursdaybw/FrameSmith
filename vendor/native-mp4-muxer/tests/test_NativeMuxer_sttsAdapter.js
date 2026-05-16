//import { convertSampleDurationsIntoSttsTableEntries } from "../adapters/adaptSttsFromSamples.js";
import { adaptSttsFromSamples } from "../adapters/adaptSttsFromSamples.js";
import { assertEqual } from "./assertions.js";

export function testNativeMuxer_AdaptSttsFromSamples_CFR() {

    const samples = [
        { duration: 512 },
        { duration: 512 },
        { duration: 512 }
    ];

    const result = adaptSttsFromSamples({ samples });

    assertEqual("entry count", result.entries.length, 1);

    assertEqual(
        "entry 0 sampleCount",
        result.entries[0].sampleCount,
        3
    );

    assertEqual(
        "entry 0 sampleDelta",
        result.entries[0].sampleDelta,
        512
    );

}

export function testNativeMuxer_AdaptSttsFromSamples_VariableDurationGroups() {

    const samples = [
        { duration: 100 },
        { duration: 100 },
        { duration: 101 },
        { duration: 101 },
        { duration: 101 },
        { duration: 100 }
    ];

    const result = adaptSttsFromSamples({ samples });

    assertEqual("entry count", result.entries.length, 3);

    assertEqual("entry 0 count", result.entries[0].sampleCount, 2);
    assertEqual("entry 0 delta", result.entries[0].sampleDelta, 100);

    assertEqual("entry 1 count", result.entries[1].sampleCount, 3);
    assertEqual("entry 1 delta", result.entries[1].sampleDelta, 101);

    assertEqual("entry 2 count", result.entries[2].sampleCount, 1);
    assertEqual("entry 2 delta", result.entries[2].sampleDelta, 100);

}
