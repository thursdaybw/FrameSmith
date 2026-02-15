import { assertIsWebmByteSource } from "./webmByteSource.js";
import { registerWebmDemuxExtractors } from "../webm/registry/registerWebmDemuxExtractors.js";
import { WebmDemuxRegistry } from "../webm/registry/WebmDemuxRegistry.js";
import { buildWebmSelector } from "../webm/selectors/buildWebmSelector.js";
import { WEBM_ELEMENT_IDS } from "../webm/ebml/webmElementIds.js";
import { readDirectChildElements } from "../webm/ebml/readDirectChildElements.js";
import { readUnsignedInteger } from "../webm/ebml/byteReaders/readUnsignedInteger.js";
import { ContainerTrackView } from "../trackview/ContainerTrackView.js";

const WEBM_TIMESCALE_US = 1_000_000;

function resolveElementEndOffset(bytes, element) {
    if (element.dataEndOffset === null) {
        return bytes.length;
    }
    return element.dataEndOffset;
}

function findDirectChildren(bytes, element) {
    const elementEndOffset = resolveElementEndOffset(bytes, element);
    return readDirectChildElements(bytes, element.dataOffset, elementEndOffset, {
        allowUnknownSizeElements: true
    });
}

function getRequiredExtractor(selector) {
    const extractor = WebmDemuxRegistry.getExtractor(selector);
    if (typeof extractor !== "function") {
        throw new Error(`openContainerFromWebmSource: missing registered extractor '${selector}'`);
    }
    return extractor;
}

function resolveMediaTypeFromTrackType(trackType) {
    if (trackType === 1) {
        return "video";
    }
    if (trackType === 2) {
        return "audio";
    }
    return null;
}

function resolveVideoCodec(codecId) {
    if (codecId === "V_VP9") {
        return "vp09.00.10.08";
    }
    throw new Error(`openContainerFromWebmSource: unsupported WebM video codecId '${codecId}'`);
}

function resolveAudioCodec(codecId) {
    if (codecId === "A_OPUS") {
        return "opus";
    }
    throw new Error(`openContainerFromWebmSource: unsupported WebM audio codecId '${codecId}'`);
}

function buildCodecConfig(track) {
    const mediaType = track.mediaType;
    if (mediaType === "video") {
        return {
            codec: resolveVideoCodec(track.codecId)
        };
    }

    if (mediaType === "audio") {
        const codecConfig = {
            codec: resolveAudioCodec(track.codecId)
        };
        if (track.audio && Number.isFinite(track.audio.samplingFrequency)) {
            codecConfig.sampleRate = Math.round(track.audio.samplingFrequency);
        }
        if (track.audio && Number.isInteger(track.audio.channels) && track.audio.channels > 0) {
            codecConfig.channelCount = track.audio.channels;
        }
        return codecConfig;
    }

    throw new Error(`openContainerFromWebmSource: unsupported media type '${String(mediaType)}'`);
}

function buildContainerMeta(track) {
    const containerMeta = {
        trackTimescale: WEBM_TIMESCALE_US
    };
    if (track.mediaType === "video" && track.video) {
        if (Number.isInteger(track.video.pixelWidth) && track.video.pixelWidth > 0) {
            containerMeta.codedWidth = track.video.pixelWidth;
        }
        if (Number.isInteger(track.video.pixelHeight) && track.video.pixelHeight > 0) {
            containerMeta.codedHeight = track.video.pixelHeight;
        }
    }
    return containerMeta;
}

function computeDefaultDurationUs(mediaType) {
    if (mediaType === "audio") {
        return 20_000;
    }
    return 33_333;
}

function assignSampleDurationsInPlace(samples, mediaType) {
    if (!Array.isArray(samples) || samples.length === 0) {
        return;
    }

    let fallbackDurationUs = computeDefaultDurationUs(mediaType);
    for (let index = 0; index < samples.length - 1; index++) {
        const current = samples[index];
        const next = samples[index + 1];
        const duration = next.pts - current.pts;
        if (duration > 0) {
            current.duration = duration;
            fallbackDurationUs = duration;
        } else {
            current.duration = fallbackDurationUs;
        }
    }

    samples[samples.length - 1].duration = fallbackDurationUs;
}

function convertTimecodeToUs(timecodeUnits, timecodeScaleNs) {
    const value = Math.round((timecodeUnits * timecodeScaleNs) / 1000);
    if (!Number.isFinite(value)) {
        throw new Error("openContainerFromWebmSource: invalid timestamp conversion result");
    }
    return value;
}

function appendBlockSample({
    track,
    block,
    clusterTimecode,
    timecodeScale
}) {
    if (block.lacingMode !== "none") {
        throw new Error(
            `openContainerFromWebmSource: unsupported block lacing mode '${block.lacingMode}'`
        );
    }

    const absoluteTimecode = clusterTimecode + block.relativeTimecode;
    const timestampUs = convertTimecodeToUs(absoluteTimecode, timecodeScale);
    track.semanticSamples.push({
        pts: timestampUs,
        dts: timestampUs,
        duration: 0,
        offset: block.payloadOffset,
        size: block.payloadSize,
        isKey: Boolean(block.keyframe)
    });
}

export async function openContainerFromWebmSource({ webmByteSource }) {
    assertIsWebmByteSource(webmByteSource);
    registerWebmDemuxExtractors();

    const webmBytes = await webmByteSource.readAll();
    if (!(webmBytes instanceof Uint8Array)) {
        throw new Error("openContainerFromWebmSource: readAll() must return Uint8Array");
    }

    const topLevel = readDirectChildElements(webmBytes, 0, webmBytes.length, {
        allowUnknownSizeElements: true
    });
    const segmentElement = topLevel.find((entry) => entry.id === WEBM_ELEMENT_IDS.SEGMENT);
    if (!segmentElement) {
        throw new Error("openContainerFromWebmSource: WebM Segment element not found");
    }

    const segmentChildren = findDirectChildren(webmBytes, segmentElement);
    const infoElement = segmentChildren.find((entry) => entry.id === WEBM_ELEMENT_IDS.INFO);
    const tracksElement = segmentChildren.find((entry) => entry.id === WEBM_ELEMENT_IDS.TRACKS);
    if (!infoElement) {
        throw new Error("openContainerFromWebmSource: Segment/Info missing");
    }
    if (!tracksElement) {
        throw new Error("openContainerFromWebmSource: Segment/Tracks missing");
    }

    const extractInfo = getRequiredExtractor(
        buildWebmSelector({ pathSegments: ["segment", "info"] })
    );
    const extractTrackEntry = getRequiredExtractor(
        buildWebmSelector({ pathSegments: ["segment", "tracks", "trackEntry"] })
    );
    const extractSimpleBlock = getRequiredExtractor(
        buildWebmSelector({ pathSegments: ["segment", "cluster", "simpleBlock"] })
    );

    const info = extractInfo({ bytes: webmBytes, element: infoElement });
    let timecodeScale = 1_000_000;
    if (Number.isInteger(info?.timecodeScale) && info.timecodeScale > 0) {
        timecodeScale = info.timecodeScale;
    }

    const trackElements = findDirectChildren(webmBytes, tracksElement).filter(
        (entry) => entry.id === WEBM_ELEMENT_IDS.TRACK_ENTRY
    );
    if (trackElements.length === 0) {
        throw new Error("openContainerFromWebmSource: no TrackEntry elements found");
    }

    const tracks = [];
    const trackByNumber = new Map();
    for (let index = 0; index < trackElements.length; index++) {
        const element = trackElements[index];
        const extracted = extractTrackEntry({ bytes: webmBytes, element });
        const mediaType = resolveMediaTypeFromTrackType(extracted.trackType);
        if (!mediaType) {
            continue;
        }
        if (!Number.isInteger(extracted.trackNumber) || extracted.trackNumber <= 0) {
            throw new Error("openContainerFromWebmSource: TrackEntry has invalid track number");
        }

        const track = {
            zeroBasedTrackIndex: tracks.length,
            trackNumber: extracted.trackNumber,
            mediaType,
            codecId: extracted.codecId,
            video: extracted.video,
            audio: extracted.audio,
            semanticSamples: []
        };

        tracks.push(track);
        trackByNumber.set(track.trackNumber, track);
    }

    const clusterElements = segmentChildren.filter((entry) => entry.id === WEBM_ELEMENT_IDS.CLUSTER);
    for (const clusterElement of clusterElements) {
        const clusterChildren = findDirectChildren(webmBytes, clusterElement);

        let clusterTimecode = 0;
        const clusterTimecodeElement = clusterChildren.find(
            (entry) => entry.id === WEBM_ELEMENT_IDS.CLUSTER_TIMECODE
        );
        if (clusterTimecodeElement) {
            clusterTimecode = readUnsignedInteger(
                webmBytes,
                clusterTimecodeElement.dataOffset,
                clusterTimecodeElement.size
            );
        }

        for (const child of clusterChildren) {
            if (child.id === WEBM_ELEMENT_IDS.SIMPLE_BLOCK) {
                const block = extractSimpleBlock({ bytes: webmBytes, element: child });
                const track = trackByNumber.get(block.trackNumber);
                if (!track) {
                    continue;
                }
                appendBlockSample({
                    track,
                    block,
                    clusterTimecode,
                    timecodeScale
                });
                continue;
            }

            if (child.id !== WEBM_ELEMENT_IDS.BLOCK_GROUP) {
                continue;
            }

            const blockGroupChildren = findDirectChildren(webmBytes, child);
            const blockElement = blockGroupChildren.find(
                (entry) => entry.id === WEBM_ELEMENT_IDS.BLOCK
            );
            if (!blockElement) {
                continue;
            }

            const block = extractSimpleBlock({ bytes: webmBytes, element: blockElement });
            const track = trackByNumber.get(block.trackNumber);
            if (!track) {
                continue;
            }
            if (track.mediaType === "audio") {
                block.keyframe = true;
            }
            appendBlockSample({
                track,
                block,
                clusterTimecode,
                timecodeScale
            });
        }
    }

    for (const track of tracks) {
        assignSampleDurationsInPlace(track.semanticSamples, track.mediaType);
    }

    const trackViewCache = new Map();
    function createTrackViewInternal(trackIndex) {
        if (trackViewCache.has(trackIndex)) {
            return trackViewCache.get(trackIndex);
        }

        const track = tracks.find((entry) => entry.zeroBasedTrackIndex === trackIndex);
        if (!track) {
            throw new Error(`openContainerFromWebmSource: unknown trackIndex ${trackIndex}`);
        }

        const view = new ContainerTrackView({
            mediaType: track.mediaType,
            containerMeta: buildContainerMeta(track),
            codecConfig: buildCodecConfig(track),
            semanticSamples: track.semanticSamples,
            mp4Bytes: webmBytes
        });
        trackViewCache.set(trackIndex, view);
        return view;
    }

    return {
        listTracks() {
            return tracks.map((track) => ({ zeroBasedTrackIndex: track.zeroBasedTrackIndex }));
        },
        createTrackView({ trackIndex }) {
            return createTrackViewInternal(trackIndex);
        },
        createTrackViews({ mediaType } = {}) {
            const all = tracks.map((track) => createTrackViewInternal(track.zeroBasedTrackIndex));
            if (typeof mediaType !== "string" || mediaType.length === 0) {
                return all;
            }
            return all.filter((trackView) => trackView.mediaType === mediaType);
        }
    };
}
