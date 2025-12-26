import { AvcCExtractor } from "../AvcCExtractor.js";

function arraysEqual(a, b) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
}

export async function testAvcCExtractor() {

    console.log("=== testAvcCExtractor ===");

    // SPS/PPS extracted from WebCodecs in this environment.
    // These values MUST remain deterministic and come from test_webcodecs_spspps.html
    const SPS = [
        103,66,192,11,140,104,66,73,168,8,8,8,60,34,17,168
    ];

    const PPS = [
        104,206,60,128
    ];

    const annexBSample = new Uint8Array([
        0x00, 0x00, 0x00, 0x01,
        ...SPS,
        0x00, 0x00, 0x00, 0x01,
        ...PPS,
        0x00, 0x00, 0x00, 0x01,
        0x65, 0x88, 0x84, 0x00
    ]);

    const extractor = new AvcCExtractor();

    extractor.ingestAnnexBSample(annexBSample);

    if (!extractor.hasConfig()) {
        throw new Error("FAIL: extractor.hasConfig() must be true after SPS+PPS ingested");
    }

    if (!arraysEqual(extractor.sequenceParameterSet, SPS)) {
        throw new Error("FAIL: extracted sequenceParameterSet does not match expected SPS");
    }

    if (!arraysEqual(extractor.pictureParameterSet, PPS)) {
        throw new Error("FAIL: extracted pictureParameterSet does not match expected PPS");
    }

    const avcC = new Uint8Array(extractor.getAvcC());

    console.log("Generated avcC:", avcC);

    // Basic structural checks:
    if (avcC[0] !== 1) throw new Error("FAIL: avcC[0] must be 1 (configurationVersion)");
    if (avcC[1] !== SPS[1]) throw new Error("FAIL: avcC profile does not match SPS profile");
    if (avcC[2] !== SPS[2]) throw new Error("FAIL: avcC compatibility mismatch");
    if (avcC[3] !== SPS[3]) throw new Error("FAIL: avcC level mismatch");

    if (avcC[4] !== 0xFF) throw new Error("FAIL: lengthSizeMinusOne must be 0xFF");

    const numSPS = avcC[5] & 0x1F;
    if (numSPS !== 1) throw new Error("FAIL: numOfSequenceParameterSets must be 1");


    console.log("PASS: AvcCExtractor tests");

    //
    // ------------------------------------------------------------
    // ADDITIONAL TEST: ingesting an avcC configuration record
    // ------------------------------------------------------------
    //
    console.log("=== testAvcCExtractor (avcC config input) ===");

    // Build a minimal AVCDecoderConfigurationRecord buffer
    // using the known-good SPS and PPS values.

    const spsLength = SPS.length;
    const ppsLength = PPS.length;

    // avcC structure:
    // [0] configurationVersion = 1
    // [1] profile
    // [2] compat
    // [3] level
    // [4] reserved + lengthSizeMinusOne
    // [5] reserved + numOfSPS
    // [6..7] SPS length
    // [..]   SPS bytes
    // [x]    numOfPPS
    // [x..]  PPS length
    // [..]   PPS bytes

    const total =
        7 +
        2 + spsLength +
        1 +
        2 + ppsLength;

    const avcRecord = new Uint8Array(total);
    let o = 0;

    avcRecord[o++] = 1;
    avcRecord[o++] = SPS[1];
    avcRecord[o++] = SPS[2];
    avcRecord[o++] = SPS[3];
    avcRecord[o++] = 0xFF;
    avcRecord[o++] = 0xE1;
    avcRecord[o++] = (spsLength >>> 8) & 0xFF;
    avcRecord[o++] = (spsLength) & 0xFF;
    avcRecord.set(SPS, o);
    o += spsLength;

    avcRecord[o++] = 1;
    avcRecord[o++] = (ppsLength >>> 8) & 0xFF;
    avcRecord[o++] = (ppsLength) & 0xFF;
    avcRecord.set(PPS, o);
    o += ppsLength;


    const extractor2 = new AvcCExtractor();
    extractor2.loadConfigurationRecord(avcRecord);

    if (!extractor2.hasConfig()) {
        throw new Error("FAIL: extractor2.hasConfig() must be true for avcC input");
    }

    // In raw avcC mode, SPS/PPS inference is not performed.
    if (extractor2.sequenceParameterSet !== null) {
        throw new Error("FAIL: extractor2.sequenceParameterSet must remain null in raw-avcC mode");
    }
    if (extractor2.pictureParameterSet !== null) {
        throw new Error("FAIL: extractor2.pictureParameterSet must remain null in raw-avcC mode");
    }

    // getAvcC() must return the same record we provided
    const returned = new Uint8Array(extractor2.getAvcC());
    if (!arraysEqual(returned, avcRecord)) {
        throw new Error("FAIL: getAvcC() did not return raw avcC input");
    }


    console.log("PASS: AvcCExtractor avcC-input tests");

}
