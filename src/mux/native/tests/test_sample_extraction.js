import {
    extractVideoSamplesFromMp4
} from "./reference/Mp4SampleExtractor.js";

export async function testSampleExtraction_FromGoldenMp4() {

    console.log("=== testSampleExtraction_FromGoldenMp4 ===");

    // ------------------------------------------------------------
    // Load reference MP4
    // ------------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    if (!resp.ok) {
        throw new Error("FAIL: could not load reference_visual.mp4");
    }

    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    // ------------------------------------------------------------
    // Execute extractor
    // ------------------------------------------------------------
    const samples = extractVideoSamplesFromMp4({ mp4Bytes });

    // ------------------------------------------------------------
    // Diagnostics FIRST (observation)
    // ------------------------------------------------------------
    console.log("Diagnostics:");

    if (!Array.isArray(samples)) {
        console.log("Extractor returned:", samples);
    } else {
        console.log("Sample count:", samples.length);

        if (samples.length > 0) {
            const first = samples[0];
            console.log("First sample:", {
                size: first.bytes?.length,
                timestamp: first.timestamp,
                duration: first.duration,
                isKey: first.isKey
            });

            const last = samples[samples.length - 1];
            console.log("Last sample:", {
                size: last.bytes?.length,
                timestamp: last.timestamp,
                duration: last.duration,
                isKey: last.isKey
            });
        }
    }

    // ------------------------------------------------------------
    // Assertions AFTER diagnostics
    // ------------------------------------------------------------
    if (!Array.isArray(samples)) {
        throw new Error("FAIL: extractor did not return an array");
    }

    if (samples.length === 0) {
        throw new Error("FAIL: No samples extracted");
    }

    for (let i = 0; i < samples.length; i++) {
        const s = samples[i];

        if (!(s.bytes instanceof Uint8Array)) {
            throw new Error(`FAIL: sample ${i} bytes is not Uint8Array`);
        }

        if (s.bytes.length === 0) {
            throw new Error(`FAIL: sample ${i} has zero-length payload`);
        }

        if (typeof s.timestamp !== "number") {
            throw new Error(`FAIL: sample ${i} missing timestamp`);
        }

        if (typeof s.duration !== "number") {
            throw new Error(`FAIL: sample ${i} missing duration`);
        }

        if (typeof s.isKey !== "boolean") {
            throw new Error(`FAIL: sample ${i} missing isKey flag`);
        }
    }

    console.log("PASS: sample extraction contract satisfied");
}
