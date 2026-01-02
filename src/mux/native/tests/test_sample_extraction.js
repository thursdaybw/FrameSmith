import {
    extractSemanticAccessUnitsFromMp4
} from "./reference/extractSemanticAccessUnitsFromMp4.js";

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
    const samples = extractSemanticAccessUnitsFromMp4({ mp4Bytes });

    if (!Array.isArray(samples)) {
        throw new Error("FAIL: extractor did not return an array");
    }

    if (samples.length === 0) {
        throw new Error("FAIL: No samples extracted");
    }

    for (let i = 0; i < samples.length; i++) {
        const s = samples[i];

        if (!Number.isInteger(s.size) || s.size <= 0) {
            throw new Error(`FAIL: sample ${i} has invalid size`);
        }

        if (!Number.isInteger(s.dts)) {
            throw new Error(`FAIL: sample ${i} missing dts`);
        }

        if (!Number.isInteger(s.pts)) {
            throw new Error(`FAIL: sample ${i} missing pts`);
        }

        if (!Number.isInteger(s.duration) || s.duration <= 0) {
            throw new Error(`FAIL: sample ${i} missing duration`);
        }

        if (typeof s.isKey !== "boolean") {
            throw new Error(`FAIL: sample ${i} missing isKey flag`);
        }

    }

    console.log("PASS: sample extraction contract satisfied");
}
