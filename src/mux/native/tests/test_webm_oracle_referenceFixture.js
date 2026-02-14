import { assertEqual, assertExists } from "./assertions.js";

function findStream(summary, codecType) {
    return summary.find((stream) => stream.codecType === codecType);
}

function findPacketSummary(summary, streamIndex) {
    return summary.find((entry) => entry.streamIndex === streamIndex);
}

export async function test_webm_oracle_referenceFixture_isPresentAndSane() {
    const webmResp = await fetch("reference/reference_webm_vp9_opus.webm");
    if (!webmResp.ok) {
        throw new Error(
            "test_webm_oracle_referenceFixture_isPresentAndSane: missing oracle " +
            "reference/reference_webm_vp9_opus.webm. Generate it using instructions in " +
            "src/mux/native/tests/reference/README.md"
        );
    }

    const oracleResp = await fetch("reference/reference_webm_vp9_opus.oracle.json");
    if (!oracleResp.ok) {
        throw new Error(
            "test_webm_oracle_referenceFixture_isPresentAndSane: missing oracle " +
            "reference/reference_webm_vp9_opus.oracle.json. Generate it using instructions in " +
            "src/mux/native/tests/reference/README.md"
        );
    }

    const oracle = await oracleResp.json();
    const streams = Array.isArray(oracle?.streamSummary) ? oracle.streamSummary : [];
    const packetSummary = Array.isArray(oracle?.packetSummary) ? oracle.packetSummary : [];

    assertEqual("oracle stream count", streams.length, 2);

    const videoStream = findStream(streams, "video");
    const audioStream = findStream(streams, "audio");
    assertExists("oracle video stream", videoStream);
    assertExists("oracle audio stream", audioStream);

    assertEqual("oracle video codec", videoStream.codecName, "vp9");
    assertEqual("oracle audio codec", audioStream.codecName, "opus");
    assertEqual("oracle video width", videoStream.width, 128);
    assertEqual("oracle video height", videoStream.height, 128);
    assertEqual("oracle audio sample rate", audioStream.sampleRate, 48000);
    assertEqual("oracle audio channels", audioStream.channels, 2);

    const videoPackets = findPacketSummary(packetSummary, videoStream.index);
    const audioPackets = findPacketSummary(packetSummary, audioStream.index);
    assertExists("oracle video packet summary", videoPackets);
    assertExists("oracle audio packet summary", audioPackets);

    assertEqual("oracle video packet count", videoPackets.packetCount, 60);
    assertEqual("oracle video keyframe count", videoPackets.keyframeCount, 2);
    assertEqual("oracle video monotonic pts", videoPackets.nonMonotonicPtsCount, 0);

    assertEqual("oracle audio packet count", audioPackets.packetCount, 101);
    assertEqual("oracle audio monotonic pts", audioPackets.nonMonotonicPtsCount, 0);
}

export const WEBM_ORACLE_REFERENCE_FIXTURE_TESTS = [
    test_webm_oracle_referenceFixture_isPresentAndSane
];

