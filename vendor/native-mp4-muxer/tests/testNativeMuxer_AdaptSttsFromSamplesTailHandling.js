import { adaptSttsFromSamples } from "../adapters/adaptSttsFromSamples.js";
import { adaptSttsWithTailFixFromSamplesAndTrackDuration } from "../adapters/adaptSttsWithTailFixFromSamplesAndTrackDuration.js";
import { assertEqual, } from "./assertions.js";

export function testNativeMuxer_AdaptSttsFromSamples_DoesNotReconcileTail() {

    const samples = [
        { duration: 100 },
        { duration: 100 },
        { duration: 100 }
    ];

    // total = 300, but we pretend oracle says 350
    const result = adaptSttsFromSamples({
        samples
    });

    assertEqual("entry count", result.entries.length, 1);
    assertEqual("sampleCount", result.entries[0].sampleCount, 3);
    assertEqual("sampleDelta", result.entries[0].sampleDelta, 100);
}

export function testNativeMuxer_AdaptSttsWithTailFix_ReconcilesFinalSample() {

    const samples = [
        { duration: 100 },
        { duration: 100 },
        { duration: 100 }
    ];

    const inputTrackDurationInTrackTimescale = 350;

    const result =
        adaptSttsWithTailFixFromSamplesAndTrackDuration({
            samples,
            inputTrackDurationInTrackTimescale
        });

    assertEqual("entry count", result.entries.length, 2);

    assertEqual("entry 0 count", result.entries[0].sampleCount, 2);
    assertEqual("entry 0 delta", result.entries[0].sampleDelta, 100);

    assertEqual("entry 1 count", result.entries[1].sampleCount, 1);
    assertEqual("entry 1 delta", result.entries[1].sampleDelta, 150);
}
