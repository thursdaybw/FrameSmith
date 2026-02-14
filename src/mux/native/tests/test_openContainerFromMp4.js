import { assertEqual } from "./assertions.js";
import { listTracksFromMp4 } from "../demux/container/listTracksFromMp4.js";
import { createContainerTrackViewFromMp4 } from "../demux/trackview/createContainerTrackViewFromMp4.js";
import { openContainerFromMp4 } from "../demux/container/openContainerFromMp4.js";
import { createMp4ByteSourceFromUint8Array } from "../demux/container/mp4ByteSource.js";
import { openContainerFromMp4Source } from "../demux/container/openContainerFromMp4Source.js";

export async function test_openContainerFromMp4_exposesTrackListingAndTrackViews() {
    const response = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await response.arrayBuffer());

    const directTracks = listTracksFromMp4({ mp4Bytes });
    const container = openContainerFromMp4({ mp4Bytes });
    const facadeTracks = container.listTracks();

    assertEqual("facade listTracks parity", facadeTracks, directTracks);

    const directVideo = createContainerTrackViewFromMp4({
        mp4Bytes,
        trackIndex: directTracks[0].zeroBasedTrackIndex
    });

    const facadeVideo = container.createTrackView({
        trackIndex: facadeTracks[0].zeroBasedTrackIndex
    });

    assertEqual(
        "facade createTrackView mediaType parity",
        facadeVideo.mediaType,
        directVideo.mediaType
    );
    assertEqual(
        "facade createTrackView sampleCount parity",
        facadeVideo.sampleCount,
        directVideo.sampleCount
    );
    assertEqual(
        "facade createTrackView timescale parity",
        facadeVideo.containerMeta.trackTimescale,
        directVideo.containerMeta.trackTimescale
    );
}

export async function test_openContainerFromMp4_createTrackViews_returnsAllAndFiltersByMediaType() {
    const response = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await response.arrayBuffer());

    const container = openContainerFromMp4({ mp4Bytes });
    const allTrackViews = container.createTrackViews();
    const videoTrackViews = container.createTrackViews({ mediaType: "video" });
    const audioTrackViews = container.createTrackViews({ mediaType: "audio" });

    assertEqual("all track view count", allTrackViews.length, 2);
    assertEqual("video track view count", videoTrackViews.length, 1);
    assertEqual("audio track view count", audioTrackViews.length, 1);
    assertEqual("video track view media type", videoTrackViews[0].mediaType, "video");
    assertEqual("audio track view media type", audioTrackViews[0].mediaType, "audio");
}

export async function test_openContainerFromMp4_rejectsInvalidInput() {
    let threw = false;
    try {
        openContainerFromMp4({ mp4Bytes: null });
    } catch (error) {
        threw = /mp4Bytes must be Uint8Array/.test(String(error?.message ?? error));
    }
    assertEqual("openContainerFromMp4 invalid input should throw", threw, true);
}

export async function test_openContainerFromMp4Source_seam_parityWithLegacyEntryPoint() {
    const response = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await response.arrayBuffer());

    const legacyContainer = openContainerFromMp4({ mp4Bytes });
    const mp4ByteSource = createMp4ByteSourceFromUint8Array({ mp4Bytes });
    const sourceContainer = await openContainerFromMp4Source({ mp4ByteSource });

    assertEqual(
        "source seam listTracks parity",
        sourceContainer.listTracks(),
        legacyContainer.listTracks()
    );

    const legacyVideoTrack = legacyContainer.createTrackViews({ mediaType: "video" })[0];
    const sourceVideoTrack = sourceContainer.createTrackViews({ mediaType: "video" })[0];

    assertEqual(
        "source seam video sampleCount parity",
        sourceVideoTrack.sampleCount,
        legacyVideoTrack.sampleCount
    );
    assertEqual(
        "source seam video timescale parity",
        sourceVideoTrack.containerMeta.trackTimescale,
        legacyVideoTrack.containerMeta.trackTimescale
    );
}
