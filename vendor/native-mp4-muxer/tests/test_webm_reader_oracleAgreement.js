import { assertEqual, assertExists } from "./assertions.js";
import { openContainer } from "../demux/container/openContainer.js";

function countKeyframes(trackView) {
    let count = 0;
    for (let index = 0; index < trackView.sampleCount; index++) {
        const sample = trackView.getSampleByIndex(index);
        if (sample && sample.isKeyframe === true) {
            count += 1;
        }
    }
    return count;
}

function countNonMonotonicPts(trackView) {
    let count = 0;
    let lastPts = null;
    for (let index = 0; index < trackView.sampleCount; index++) {
        const sample = trackView.getSampleByIndex(index);
        if (!sample) {
            continue;
        }
        if (typeof sample.pts !== "number") {
            continue;
        }
        if (lastPts !== null && sample.pts < lastPts) {
            count += 1;
        }
        lastPts = sample.pts;
    }
    return count;
}

function getPtsSummary(trackView) {
    if (!trackView || trackView.sampleCount === 0) {
        return {
            firstPtsUs: null,
            lastPtsUs: null,
            spanUs: 0
        };
    }

    const first = trackView.getSampleByIndex(0);
    const last = trackView.getSampleByIndex(trackView.sampleCount - 1);
    const firstPtsUs = first?.pts;
    const lastPtsUs = last?.pts;
    return {
        firstPtsUs,
        lastPtsUs,
        spanUs: lastPtsUs - firstPtsUs
    };
}

function findPacketSummaryByCodecType({ oracle, codecType }) {
    const streamSummary = Array.isArray(oracle?.streamSummary) ? oracle.streamSummary : [];
    const packetSummary = Array.isArray(oracle?.packetSummary) ? oracle.packetSummary : [];

    const stream = streamSummary.find((entry) => entry.codecType === codecType);
    assertExists(`oracle ${codecType} stream`, stream);

    const packets = packetSummary.find((entry) => entry.streamIndex === stream.index);
    assertExists(`oracle ${codecType} packet summary`, packets);
    return packets;
}

async function loadReaderAgreementFixture({ fixturePath, oraclePath, testLabel }) {
    const bytesResponse = await fetch(fixturePath);
    if (!bytesResponse.ok) {
        throw new Error(
            `${testLabel}: missing oracle ${fixturePath}. Generate it using instructions in ` +
            "tests/reference/README.md"
        );
    }
    const webmBytes = new Uint8Array(await bytesResponse.arrayBuffer());

    const oracleResponse = await fetch(oraclePath);
    if (!oracleResponse.ok) {
        throw new Error(
            `${testLabel}: missing oracle ${oraclePath}. Generate it using instructions in ` +
            "tests/reference/README.md"
        );
    }
    const oracle = await oracleResponse.json();
    return { webmBytes, oracle };
}

async function assertOpenContainerReaderAgreement({ webmBytes, oracle }) {
    const container = await openContainer({
        containerType: "webm",
        bytes: webmBytes
    });

    const videoTrackView = container.createTrackViews({ mediaType: "video" })[0];
    const audioTrackView = container.createTrackViews({ mediaType: "audio" })[0];
    assertExists("video track view", videoTrackView);
    assertExists("audio track view", audioTrackView);

    const videoOracle = findPacketSummaryByCodecType({ oracle, codecType: "video" });
    const audioOracle = findPacketSummaryByCodecType({ oracle, codecType: "audio" });

    assertEqual("video packet count agreement", videoTrackView.sampleCount, videoOracle.packetCount);
    assertEqual("audio packet count agreement", audioTrackView.sampleCount, audioOracle.packetCount);
    assertEqual("video keyframe count agreement", countKeyframes(videoTrackView), videoOracle.keyframeCount);
    assertEqual("audio keyframe count agreement", countKeyframes(audioTrackView), audioOracle.keyframeCount);
    assertEqual(
        "video non-monotonic pts agreement",
        countNonMonotonicPts(videoTrackView),
        videoOracle.nonMonotonicPtsCount
    );
    assertEqual(
        "audio non-monotonic pts agreement",
        countNonMonotonicPts(audioTrackView),
        audioOracle.nonMonotonicPtsCount
    );

    const videoPts = getPtsSummary(videoTrackView);
    const audioPts = getPtsSummary(audioTrackView);
    const oracleVideoSpanUs = (videoOracle.lastPts - videoOracle.firstPts) * 1000;
    const oracleAudioSpanUs = (audioOracle.lastPts - audioOracle.firstPts) * 1000;
    assertEqual("video pts span agreement", videoPts.spanUs, oracleVideoSpanUs);
    assertEqual("audio pts span agreement", audioPts.spanUs, oracleAudioSpanUs);

    const oracleVideoFirstUs = videoOracle.firstPts * 1000;
    const oracleVideoLastUs = videoOracle.lastPts * 1000;
    const oracleAudioFirstUs = audioOracle.firstPts * 1000;
    const oracleAudioLastUs = audioOracle.lastPts * 1000;
    assertEqual("video first pts agreement", videoPts.firstPtsUs, oracleVideoFirstUs);
    assertEqual("video last pts agreement", videoPts.lastPtsUs, oracleVideoLastUs);
    assertEqual("audio first pts agreement", audioPts.firstPtsUs, oracleAudioFirstUs);
    assertEqual("audio last pts agreement", audioPts.lastPtsUs, oracleAudioLastUs);
}

export async function test_webm_openContainer_readerAgreement_withStoredOracle() {
    const { webmBytes, oracle } = await loadReaderAgreementFixture({
        fixturePath: "reference/reference_webm_vp9_opus.webm",
        oraclePath: "reference/reference_webm_vp9_opus.oracle.json",
        testLabel: "test_webm_openContainer_readerAgreement_withStoredOracle"
    });
    await assertOpenContainerReaderAgreement({ webmBytes, oracle });
}

export const WEBM_READER_ORACLE_AGREEMENT_TESTS = [
    test_webm_openContainer_readerAgreement_withStoredOracle
];
