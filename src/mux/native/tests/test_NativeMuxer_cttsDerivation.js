import { deriveCttsEntries } from "../deriveCttsEntries.js";
import { assertEqual } from "./assertions.js";

export function testNativeMuxer_DeriveCttsEntries_RunLengthEncoding() {

    console.log(
        "=== testNativeMuxer_DeriveCttsEntries_RunLengthEncoding ==="
    );

    const samples = [
        { compositionOffset: 0 },
        { compositionOffset: 0 },
        { compositionOffset: 512 },
        { compositionOffset: 512 },
        { compositionOffset: 512 },
        { compositionOffset: 0 }
    ];

    const entries = deriveCttsEntries({ samples });

    assertEqual("entry.count", entries.length, 3);

    assertEqual("entry[0].count", entries[0].sampleCount, 2);
    assertEqual("entry[0].offset", entries[0].sampleOffset, 0);

    assertEqual("entry[1].count", entries[1].sampleCount, 3);
    assertEqual("entry[1].offset", entries[1].sampleOffset, 512);

    assertEqual("entry[2].count", entries[2].sampleCount, 1);
    assertEqual("entry[2].offset", entries[2].sampleOffset, 0);

    console.log(
        "PASS: CTTS derivation (run-length encoded offsets)"
    );
}
