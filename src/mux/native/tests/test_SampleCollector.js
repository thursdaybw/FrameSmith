import { SampleCollector } from "../SampleCollector.js";

function arraysEqual(a, b) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
}

export async function testSampleCollector() {

    console.log("=== testSampleCollector ===");

    const sc = new SampleCollector();

    // ---- TEST 1: Add one sample -----------------------------------
    const sampleA = new Uint8Array([1, 2, 3]);
    
    sc.addSample({
        data: sampleA,
        size: sampleA.length,
        isKey: true,
        timestampMicroseconds: 1000,
        durationMicroseconds: 33333
    });

    if (sc.samples.length !== 1) {
        throw new Error("FAIL: samples length should be 1");
    }

    if (!arraysEqual(sc.samples[0].data, sampleA)) {
        throw new Error("FAIL: stored sample data does not match input");
    }

    if (sc.totalMdatSize !== 3) {
        throw new Error("FAIL: totalMdatSize should equal 3 after one sample");
    }

    // ---- TEST 2: Multiple samples preserve order -------------------
    const sampleB = new Uint8Array([9, 9, 9, 9]);

    sc.addSample({
        data: sampleB,
        size: sampleB.length,
        isKey: false,
        timestampMicroseconds: 2000,
        durationMicroseconds: 33333
    });

    if (sc.samples.length !== 2) {
        throw new Error("FAIL: samples length should be 2");
    }

    if (!arraysEqual(sc.samples[1].data, sampleB)) {
        throw new Error("FAIL: second sample data mismatch");
    }

    if (sc.totalMdatSize !== 3 + 4) {
        throw new Error("FAIL: totalMdatSize should be 7");
    }

    // ---- TEST 3: freeze() returns a COPY ----------------------------
    const frozen = sc.freeze();
    frozen[0].data[0] = 99;

    if (sc.samples[0].data[0] === 99) {
        throw new Error("FAIL: freeze() result mutating internal data!");
    }

    // ---- TEST 4: Mutating original input must NOT mutate stored data
    sampleA[0] = 42;

    if (sc.samples[0].data[0] === 42) {
        throw new Error("FAIL: SampleCollector stores references instead of clones");
    }

    console.log("PASS: SampleCollector tests");
}

