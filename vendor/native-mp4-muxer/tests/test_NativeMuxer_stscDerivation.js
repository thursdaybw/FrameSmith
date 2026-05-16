import { deriveStscEntries } from "../derivers/deriveStscEntries.js";
import { assertEqual } from "./assertions.js";

export function testNativeMuxer_DeriveStscEntries_SingleChunkPattern() {

    // ---------------------------------------------------------
    // Canonical semantic samples
    // ---------------------------------------------------------
    const samples = [
        { duration: 512, sampleDescriptionIndex: 1 },
        { duration: 512, sampleDescriptionIndex: 1 },
        { duration: 512, sampleDescriptionIndex: 1 }
    ];

    // ---------------------------------------------------------
    // Canonical wrapped chunk model
    // ---------------------------------------------------------
    const chunks = [
        {
            samples: samples.map((sample, index) => ({
                sample,
                sampleIndex: index
            }))
        }
    ];

    // ---------------------------------------------------------
    // Guard: STSC must not depend on per-sample timing
    // ---------------------------------------------------------
    samples[0].duration = 999999;

    // ---------------------------------------------------------
    // Execute derivation
    // ---------------------------------------------------------
    const entries = deriveStscEntries({
        samples,
        chunks
    });

    // ---------------------------------------------------------
    // Structural assertions
    // ---------------------------------------------------------
    assertEqual("stsc.entry.count", entries.length, 1);

    const e = entries[0];

    assertEqual("stsc.firstChunk", e.firstChunk, 1);
    assertEqual("stsc.samplesPerChunk", e.samplesPerChunk, 3);
    assertEqual("stsc.sampleDescriptionIndex", e.sampleDescriptionIndex, 1);

    // ---------------------------------------------------------
    // Indexing invariant (1-based, MP4 spec)
    // ---------------------------------------------------------
    assertEqual(
        "stsc.firstChunk.isOneBased",
        e.firstChunk >= 1,
        true
    );

}

