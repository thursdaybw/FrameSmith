import { Timeline } from '../../vendor/media-timeline-compiler/Timeline.js';
import { Track } from '../../vendor/media-timeline-compiler/Track.js';
import { Clip } from '../../vendor/media-timeline-compiler/Clip.js';
import { ProceduralClip } from '../../vendor/media-timeline-compiler/ProceduralClip.js';

const DEFAULT_TEXT_OVERLAY_STYLE = Object.freeze({
    // Mirrors Drupal caption style: bevan_s_bench_portrait
    fontFamily: "'FrameSmithAntonSC', 'Anton SC', 'Anton', 'Arial Black', sans-serif",
    fontWeight: 700,
    fontSizePx: 40,
    lineHeightPx: 50,
    // Drupal ASS style uses MarginL/MarginR=200 on 1920 and MarginV=175 on 1080.
    // For 720x1280 export this maps closely to:
    sidePaddingPx: 75,
    bottomPaddingPx: 208,
    textAlign: "center",
    // ASS colors use AABBGGRR; values below are converted to CSS RGB.
    // primaryColour: &H0065bdd7 -> #d7bd65
    // primaryHighlight.primaryColour: &H00e1c46b -> #6bc4e1
    // secondaryHighlight.primaryColour: &H007a5d66 -> #665d7a
    baseFill: "#D7BD65",
    baseStroke: "#000000",
    strokeWidthPx: 2,
    activeFill: "#6BC4E1",
    secondaryActiveFill: "#665D7A",
    secondaryHighlightEvery: 5,
    // Old Drupal ASS chunking defaults (AssSubtitleGenerator)
    maxWordsPerChunk: 6,
    maxChunkDurationSeconds: 2.0,
    pauseSplitThresholdSeconds: 0.3,
    shadowColor: "rgba(0, 0, 0, 0)",
    shadowBlurPx: 0
});


export function createTimelineFromPreparedAssets({
    trackViews,
    textOverlayItems = [],
    imageOverlayItems = []
}) {
    if (!Array.isArray(trackViews)) {
        throw new Error("createTimelineFromPreparedAssets: trackViews must be array");
    }

    const timeline = new Timeline(30);

    const videoTracks = trackViews.filter(t => t.mediaType === "video");
    const audioTracks = trackViews.filter(t => t.mediaType === "audio");

    if (!videoTracks[0]) {
        throw new Error("createTimelineFromPreparedAssets: no video track");
    }
    if (!audioTracks[0]) {
        throw new Error("createTimelineFromPreparedAssets: no audio track");
    }

    const videoTrack = new Track();
    const audioTrack = new Track();

    const resolveTrackClipRangeSeconds = (trackView, mediaLabel) => {
        const sampleCount = Number(trackView?.sampleCount ?? 0);
        if (!Number.isInteger(sampleCount) || sampleCount <= 0) {
            throw new Error(`createTimelineFromPreparedAssets: ${mediaLabel} track has no samples`);
        }

        const firstSample = trackView.getSampleByIndex(0);
        const lastSample = trackView.getSampleByIndex(sampleCount - 1);
        if (!firstSample || !lastSample) {
            throw new Error(`createTimelineFromPreparedAssets: ${mediaLabel} track samples are unavailable`);
        }

        const firstPts = Number(firstSample.pts);
        const lastPts = Number(lastSample.pts);
        const lastDuration = Number(lastSample.duration);
        const trackTimescale = Number(trackView?.containerMeta?.trackTimescale);

        if (!Number.isFinite(firstPts) || !Number.isFinite(lastPts)) {
            throw new Error(
                `createTimelineFromPreparedAssets: invalid ${mediaLabel} sample timestamps ` +
                `(firstPts=${firstPts}, lastPts=${lastPts}, trackTimescale=${trackTimescale})`
            );
        }

        if (!Number.isFinite(trackTimescale) || trackTimescale <= 0) {
            throw new Error(
                `createTimelineFromPreparedAssets: invalid ${mediaLabel} trackTimescale ` +
                `(trackTimescale=${trackTimescale})`
            );
        }

        const inclusiveEndPts = lastPts + (Number.isFinite(lastDuration) && lastDuration > 0 ? lastDuration : 1);

        const startSeconds = trackView.ptsToSeconds(firstPts);
        const endSeconds = trackView.ptsToSeconds(inclusiveEndPts);

        if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) || endSeconds <= startSeconds) {
            throw new Error(
                `createTimelineFromPreparedAssets: invalid ${mediaLabel} range ` +
                `(startSeconds=${startSeconds}, endSeconds=${endSeconds}, ` +
                `firstPts=${firstPts}, lastPts=${lastPts}, lastDuration=${lastDuration}, trackTimescale=${trackTimescale})`
            );
        }

        return { startSeconds, endSeconds };
    };

    const videoClipRange = resolveTrackClipRangeSeconds(videoTracks[0], "video");
    const audioClipRange = resolveTrackClipRangeSeconds(audioTracks[0], "audio");
    const mediaTimelineEndSeconds = Math.max(
        Number(videoClipRange.endSeconds) || 0,
        Number(audioClipRange.endSeconds) || 0
    );

    timeline.addTrack(videoTrack);
    timeline.addTrack(audioTrack);

    videoTrack.addClip(
        new Clip({
            trackView: videoTracks[0],
            startSeconds: videoClipRange.startSeconds,
            endSeconds: videoClipRange.endSeconds
        })
    );

    audioTrack.addClip(
        new Clip({
            trackView: audioTracks[0],
            startSeconds: audioClipRange.startSeconds,
            endSeconds: audioClipRange.endSeconds
        })
    );

    const overlayTrack = new Track();
    timeline.addTrack(overlayTrack);

    const overlayItems = Array.isArray(textOverlayItems) && textOverlayItems.length > 0
        ? textOverlayItems
        : [
            {
                id: "fallback-overlay",
                startSeconds: 0,
                endSeconds: 10,
                words: [
                    { start: 0, end: 3, text: "Hello" },
                    { start: 3, end: 6, text: "Beautiful" },
                    { start: 6, end: 9, text: "World" }
                ],
                style: {
                    ...DEFAULT_TEXT_OVERLAY_STYLE
                },
                override: [],
                animate: []
            }
        ];
    const overlayClipStartSeconds = overlayItems.reduce((minStart, item) => {
        const start = typeof item?.startSeconds === "number" ? item.startSeconds : minStart;
        return Math.min(minStart, start);
    }, Number.POSITIVE_INFINITY);
    const overlayClipEndSeconds = overlayItems.reduce((maxEnd, item) => {
        const end = typeof item?.endSeconds === "number" ? item.endSeconds : maxEnd;
        return Math.max(maxEnd, end);
    }, 0);

    overlayTrack.addClip(
        new ProceduralClip({
            kind: "text-overlay",
            startSeconds: Number.isFinite(overlayClipStartSeconds) ? overlayClipStartSeconds : 0,
            endSeconds: overlayClipEndSeconds > 0 ? overlayClipEndSeconds : 10,
            items: overlayItems
        })
    );

    if (Array.isArray(imageOverlayItems) && imageOverlayItems.length > 0) {
        const imageOverlayTrack = new Track();
        timeline.addTrack(imageOverlayTrack);

        const normalizedImageOverlayItems = imageOverlayItems.map((item) => {
            if (!item || typeof item !== "object") {
                return item;
            }
            if (typeof item.endSeconds === "number" && Number.isFinite(item.endSeconds)) {
                return item;
            }
            return {
                ...item,
                endSeconds: mediaTimelineEndSeconds > 0 ? mediaTimelineEndSeconds : 10
            };
        });

        const imageOverlayStartSeconds = normalizedImageOverlayItems.reduce((minStart, item) => {
            const start = typeof item?.startSeconds === "number" ? item.startSeconds : minStart;
            return Math.min(minStart, start);
        }, Number.POSITIVE_INFINITY);
        const imageOverlayEndSeconds = normalizedImageOverlayItems.reduce((maxEnd, item) => {
            const end = typeof item?.endSeconds === "number" ? item.endSeconds : maxEnd;
            return Math.max(maxEnd, end);
        }, 0);

        imageOverlayTrack.addClip(
            new ProceduralClip({
                kind: "image-overlay",
                startSeconds: Number.isFinite(imageOverlayStartSeconds) ? imageOverlayStartSeconds : 0,
                endSeconds: imageOverlayEndSeconds > 0 ? imageOverlayEndSeconds : 10,
                items: normalizedImageOverlayItems
            })
        );
    }

    return timeline;
}
