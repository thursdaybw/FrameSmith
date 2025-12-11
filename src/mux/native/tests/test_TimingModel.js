import { TimingModel } from "../TimingModel.js";

export async function testTimingModel() {

    console.log("=== testTimingModel ===");

    const fps = 30;
    const model = new TimingModel(fps);

    const expectedDurationPerFrame = Math.floor(90000 / fps);
    if (expectedDurationPerFrame !== 3000) {
        throw new Error("FAIL: unexpected duration per frame calculation");
    }

    // ---- TEST 1: Adding one frame ------------------------------------
    model.addFrame(0); // timestamp in microseconds

    if (model.frameCount !== 1) {
        throw new Error("FAIL: frameCount should be 1 after first frame");
    }

    if (model.lastTimestampTicks !== 0) {
        throw new Error("FAIL: timestamp conversion incorrect for 0us");
    }

    // ---- TEST 2: Add more frames -------------------------------------
    model.addFrame(33333);
    model.addFrame(66666);

    if (model.frameCount !== 3) {
        throw new Error("FAIL: frameCount should be 3 after three frames");
    }

    const oneSecondTicks = Math.round(1_000_000 * 90 / 1000); // 90000
    const conv = model.convertMicrosecondsToTicks(1_000_000);

    if (conv !== 90000) {
        throw new Error("FAIL: convertMicrosecondsToTicks incorrect for 1 second");
    }

    // ---- TEST 3: finalize() structure --------------------------------
    const result = model.finalize();

    // stts must have exactly one run because we are fixed frame rate
    if (!Array.isArray(result.sttsEntries) || result.sttsEntries.length !== 1) {
        throw new Error("FAIL: sttsEntries must contain exactly one entry");
    }

    const entry = result.sttsEntries[0];

    if (entry.sampleCount !== 3) {
        throw new Error("FAIL: sttsEntries.sampleCount incorrect");
    }

    if (entry.sampleDuration !== expectedDurationPerFrame) {
        throw new Error("FAIL: sttsEntries.sampleDuration incorrect");
    }

    if (result.totalDuration !== expectedDurationPerFrame * 3) {
        throw new Error("FAIL: totalDuration incorrect");
    }

    // ---- TEST 4: finalize locks the model -----------------------------
    let threw = false;
    try {
        model.addFrame(100000);
    } catch (err) {
        threw = true;
    }

    if (!threw) {
        throw new Error("FAIL: addFrame after finalize must throw an error");
    }

    console.log("PASS: TimingModel tests");
}

