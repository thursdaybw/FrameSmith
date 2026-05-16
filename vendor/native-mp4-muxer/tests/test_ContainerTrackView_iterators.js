import { assertEqual, assertArrayEqual } from "./assertions.js";
import { ContainerTrackView } from "../demux/trackview/ContainerTrackView.js";

function buildSyntheticView() {
    const mp4Bytes = new Uint8Array(64);
    for (let i = 0; i < mp4Bytes.length; i++) {
        mp4Bytes[i] = i;
    }

    const semanticSamples = [
        { pts: 0, dts: 0, duration: 10, offset: 0, size: 4, isKey: true },
        { pts: 20, dts: 10, duration: 10, offset: 4, size: 4, isKey: false },
        { pts: 10, dts: 20, duration: 10, offset: 8, size: 4, isKey: false },
        { pts: 30, dts: 30, duration: 10, offset: 12, size: 4, isKey: false }
    ];

    return new ContainerTrackView({
        mediaType: "video",
        containerMeta: { trackTimescale: 1000 },
        codecConfig: { codec: "avc1" },
        semanticSamples,
        mp4Bytes
    });
}

export async function test_ContainerTrackView_iterateSamplesByPtsRange_reorderedPts_noEarlyBreak() {
    const view = buildSyntheticView();
    const ptsValues = Array.from(view.iterateSamplesByPtsRange(0, 20)).map((sample) => sample.pts);

    assertArrayEqual(
        "iterateSamplesByPtsRange should include reordered PTS samples in decode-order walk",
        ptsValues,
        [0, 20, 10]
    );
}

export async function test_ContainerTrackView_iterateSamplesByDtsRange_filtersByDts() {
    const view = buildSyntheticView();
    const dtsValues = Array.from(view.iterateSamplesByDtsRange(10, 20)).map((sample) => sample.dts);

    assertArrayEqual(
        "iterateSamplesByDtsRange should filter using DTS",
        dtsValues,
        [10, 20]
    );
}

export async function test_ContainerTrackView_getTrackIdentity_reportsStableShape() {
    const view = buildSyntheticView();
    const identity = view.getTrackIdentity();

    assertEqual("track identity mediaType", identity.mediaType, "video");
    assertEqual("track identity sampleCount", identity.sampleCount, 4);
    assertEqual("track identity trackTimescale", identity.trackTimescale, 1000);
}
