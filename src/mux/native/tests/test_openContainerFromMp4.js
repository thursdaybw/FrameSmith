import { assertEqual, assertExists, assertNotExists } from "./assertions.js";
import { listTracksFromMp4 } from "../demux/container/listTracksFromMp4.js";
import { createContainerTrackViewFromMp4 } from "../demux/trackview/createContainerTrackViewFromMp4.js";
import { openContainerFromMp4 } from "../demux/container/openContainerFromMp4.js";
import { createMp4ByteSourceFromUint8Array } from "../demux/container/mp4ByteSource.js";
import { openContainerFromMp4Source } from "../demux/container/openContainerFromMp4Source.js";
import { openContainer } from "../demux/container/openContainer.js";
import { createWebmByteSourceFromUint8Array } from "../demux/container/webmByteSource.js";
import { openContainerFromWebmSource } from "../demux/container/openContainerFromWebmSource.js";

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

    const displayTransform = videoTrackViews[0].containerMeta.displayTransform;
    assertExists("video.containerMeta.displayTransform", displayTransform);
    assertEqual(
        "video.containerMeta.displayTransform.rotationDegrees",
        displayTransform.rotationDegrees,
        0
    );
    assertEqual(
        "video.containerMeta.displayTransform.matrix.length",
        Array.isArray(displayTransform.matrix) ? displayTransform.matrix.length : -1,
        9
    );
    assertNotExists(
        "audio.containerMeta.displayTransform",
        audioTrackViews[0].containerMeta.displayTransform
    );
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

export async function test_openContainer_routesMp4ByExplicitContainerTypeFromBytes() {
    const response = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await response.arrayBuffer());

    const legacyContainer = openContainerFromMp4({ mp4Bytes });
    const routedContainer = await openContainer({
        containerType: "mp4",
        bytes: mp4Bytes
    });

    assertEqual(
        "openContainer explicit mp4 bytes listTracks parity",
        routedContainer.listTracks(),
        legacyContainer.listTracks()
    );
}

export async function test_openContainer_routesMp4ByExplicitContainerTypeFromByteSource() {
    const response = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await response.arrayBuffer());
    const mp4ByteSource = createMp4ByteSourceFromUint8Array({ mp4Bytes });

    const seamContainer = await openContainerFromMp4Source({ mp4ByteSource });
    const routedContainer = await openContainer({
        containerType: "mp4",
        byteSource: mp4ByteSource
    });

    assertEqual(
        "openContainer explicit mp4 byteSource listTracks parity",
        routedContainer.listTracks(),
        seamContainer.listTracks()
    );
}

export async function test_openContainer_sniffsMp4FromBytes() {
    const response = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await response.arrayBuffer());

    const routedContainer = await openContainer({ bytes: mp4Bytes });
    const tracks = routedContainer.listTracks();

    assertEqual("openContainer sniff bytes track count", tracks.length, 2);
}

export async function test_openContainer_sniffsMp4FromByteSource() {
    const response = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await response.arrayBuffer());
    const mp4ByteSource = createMp4ByteSourceFromUint8Array({ mp4Bytes });

    const routedContainer = await openContainer({ byteSource: mp4ByteSource });
    const tracks = routedContainer.listTracks();

    assertEqual("openContainer sniff byteSource track count", tracks.length, 2);
}

export async function test_openContainer_rejectsUnsupportedContainerType() {
    let threw = false;
    try {
        await openContainer({
            containerType: "flv",
            bytes: new Uint8Array([0x00, 0x00, 0x00, 0x00])
        });
    } catch (error) {
        threw = /unsupported containerType/.test(String(error?.message ?? error));
    }
    assertEqual("openContainer unsupported type should throw", threw, true);
}

export async function test_openContainer_rejectsWebmUntilImplemented() {
    let threw = false;
    try {
        await openContainer({
            containerType: "webm",
            bytes: new Uint8Array([0x1A, 0x45, 0xDF, 0xA3])
        });
    } catch (error) {
        threw = /WebM routing is not implemented yet/.test(String(error?.message ?? error));
    }
    assertEqual("openContainer webm should throw planned-not-implemented", threw, true);
}

export async function test_openContainer_rejectsWebmByByteSourceUntilImplemented() {
    const webmBytes = new Uint8Array([0x1A, 0x45, 0xDF, 0xA3, 0x00, 0x00, 0x00, 0x00]);
    const webmByteSource = createWebmByteSourceFromUint8Array({ webmBytes });
    let threw = false;
    try {
        await openContainer({
            containerType: "webm",
            byteSource: webmByteSource
        });
    } catch (error) {
        threw = /WebM routing is not implemented yet/.test(String(error?.message ?? error));
    }
    assertEqual("openContainer webm byteSource should throw planned-not-implemented", threw, true);
}

export async function test_openContainerFromWebmSource_rejectsInvalidSource() {
    let threw = false;
    try {
        await openContainerFromWebmSource({ webmByteSource: null });
    } catch (error) {
        threw = /webmByteSource must be an object/.test(String(error?.message ?? error));
    }
    assertEqual("openContainerFromWebmSource invalid source should throw", threw, true);
}
