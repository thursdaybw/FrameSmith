import { deriveSttsEntries } from "../deriveSttsEntries.js";
import { assertEqual } from "./assertions.js";

export function testNativeMuxer_DeriveSttsEntries_RunLengthEncoding() {

    console.log(
        "=== testNativeMuxer_DeriveSttsEntries_RunLengthEncoding ==="
    );

    const samples = [
        { duration: 512 },
        { duration: 512 },
        { duration: 512 },
        { duration: 256 },
        { duration: 256 },
        { duration: 512 }
    ];

    const entries = deriveSttsEntries({ samples });

    assertEqual("stts.entry.count", entries.length, 3);

    assertEqual("entry[0].count", entries[0].sampleCount, 3);
    assertEqual("entry[0].duration", entries[0].sampleDuration, 512);

    assertEqual("entry[1].count", entries[1].sampleCount, 2);
    assertEqual("entry[1].duration", entries[1].sampleDuration, 256);

    assertEqual("entry[2].count", entries[2].sampleCount, 1);
    assertEqual("entry[2].duration", entries[2].sampleDuration, 512);

    console.log(
        "PASS: STTS derivation (run-length encoded durations)"
    );
}
