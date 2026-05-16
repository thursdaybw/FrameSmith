import { assertEqual, assertExists } from "./assertions.js";
import { WEBM_ELEMENT_IDS } from "../demux/webm/ebml/webmElementIds.js";
import { readDirectChildElements } from "../demux/webm/ebml/readDirectChildElements.js";
import { readUnsignedInteger } from "../demux/webm/ebml/byteReaders/readUnsignedInteger.js";
import { extractSegmentInfo } from "../demux/webm/extractors/segment/extractSegmentInfo.js";
import { extractTrackEntry } from "../demux/webm/extractors/tracks/extractTrackEntry.js";
import { extractSimpleBlock } from "../demux/webm/extractors/cluster/extractSimpleBlock.js";

function resolveElementEndOffset(bytes, element) {
    if (element.dataEndOffset === null) {
        return bytes.length;
    }
    return element.dataEndOffset;
}

async function loadReferenceWebmBytes() {
    const response = await fetch("reference/reference_webm_vp9_opus.webm");
    if (!response.ok) {
        throw new Error(
            "test_webm_extractors: missing oracle reference/reference_webm_vp9_opus.webm. " +
            "Generate it using instructions in tests/reference/README.md"
        );
    }
    return new Uint8Array(await response.arrayBuffer());
}

function findSegmentElement(bytes) {
    const topLevel = readDirectChildElements(bytes, 0, bytes.length, {
        allowUnknownSizeElements: true
    });
    const segment = topLevel.find((entry) => entry.id === WEBM_ELEMENT_IDS.SEGMENT);
    assertExists("segment element", segment);
    return segment;
}

function findDirectChildren(bytes, element) {
    return readDirectChildElements(
        bytes,
        element.dataOffset,
        resolveElementEndOffset(bytes, element),
        { allowUnknownSizeElements: true }
    );
}

export async function test_webm_extractSegmentInfo_fromReferenceFixture() {
    const bytes = await loadReferenceWebmBytes();
    const segment = findSegmentElement(bytes);
    const segmentChildren = findDirectChildren(bytes, segment);
    const info = segmentChildren.find((entry) => entry.id === WEBM_ELEMENT_IDS.INFO);
    assertExists("info element", info);

    const extracted = extractSegmentInfo({ bytes, element: info });
    assertEqual("timecode scale", extracted.timecodeScale, 1000000);
    if (!(typeof extracted.duration === "number" && extracted.duration > 2000 && extracted.duration < 2100)) {
        throw new Error(
            `FAIL: duration expected near 2008ms, actual=${String(extracted.duration)}`
        );
    }
}

export async function test_webm_extractTrackEntry_fromReferenceFixture() {
    const bytes = await loadReferenceWebmBytes();
    const segment = findSegmentElement(bytes);
    const segmentChildren = findDirectChildren(bytes, segment);
    const tracks = segmentChildren.find((entry) => entry.id === WEBM_ELEMENT_IDS.TRACKS);
    assertExists("tracks element", tracks);

    const trackEntries = findDirectChildren(bytes, tracks).filter(
        (entry) => entry.id === WEBM_ELEMENT_IDS.TRACK_ENTRY
    );
    assertEqual("track entry count", trackEntries.length, 2);

    const extractedEntries = trackEntries.map((entry) => extractTrackEntry({ bytes, element: entry }));
    const video = extractedEntries.find((entry) => entry.trackType === 1);
    const audio = extractedEntries.find((entry) => entry.trackType === 2);
    assertExists("video track entry", video);
    assertExists("audio track entry", audio);

    assertEqual("video codec id", video.codecId, "V_VP9");
    assertEqual("video pixel width", video.video?.pixelWidth, 128);
    assertEqual("video pixel height", video.video?.pixelHeight, 128);

    assertEqual("audio codec id", audio.codecId, "A_OPUS");
    assertEqual("audio channels", audio.audio?.channels, 2);
    assertEqual("audio sample rate", Math.round(audio.audio?.samplingFrequency ?? 0), 48000);
    if (!(audio.codecPrivate instanceof Uint8Array) || audio.codecPrivate.length === 0) {
        throw new Error("FAIL: audio codecPrivate expected non-empty Uint8Array");
    }
}

export async function test_webm_extractSimpleBlock_countsAndTiming_fromReferenceFixture() {
    const bytes = await loadReferenceWebmBytes();
    const segment = findSegmentElement(bytes);
    const segmentChildren = findDirectChildren(bytes, segment);
    const tracks = segmentChildren.find((entry) => entry.id === WEBM_ELEMENT_IDS.TRACKS);
    assertExists("tracks element", tracks);

    const trackEntries = findDirectChildren(bytes, tracks).filter(
        (entry) => entry.id === WEBM_ELEMENT_IDS.TRACK_ENTRY
    );
    const extractedTracks = trackEntries.map((entry) => extractTrackEntry({ bytes, element: entry }));
    const videoTrack = extractedTracks.find((entry) => entry.trackType === 1);
    const audioTrack = extractedTracks.find((entry) => entry.trackType === 2);
    assertExists("video track", videoTrack);
    assertExists("audio track", audioTrack);

    const statsByTrack = new Map();

    const clusterElements = segmentChildren.filter((entry) => entry.id === WEBM_ELEMENT_IDS.CLUSTER);
    for (const cluster of clusterElements) {
        const clusterChildren = findDirectChildren(bytes, cluster);
        const clusterTimecodeElement = clusterChildren.find(
            (entry) => entry.id === WEBM_ELEMENT_IDS.CLUSTER_TIMECODE
        );
        const clusterTimecode = clusterTimecodeElement
            ? readUnsignedInteger(bytes, clusterTimecodeElement.dataOffset, clusterTimecodeElement.size)
            : 0;

        for (const child of clusterChildren) {
            const blockElements = [];
            if (child.id === WEBM_ELEMENT_IDS.SIMPLE_BLOCK) {
                blockElements.push(child);
            } else if (child.id === WEBM_ELEMENT_IDS.BLOCK_GROUP) {
                const blockGroupChildren = findDirectChildren(bytes, child);
                const blockElement = blockGroupChildren.find(
                    (entry) => entry.id === WEBM_ELEMENT_IDS.BLOCK
                );
                if (blockElement) {
                    blockElements.push(blockElement);
                }
            }

            for (const blockElement of blockElements) {
                const block = extractSimpleBlock({ bytes, element: blockElement });
                if (!(block.payloadBytes instanceof Uint8Array) || block.payloadBytes.length === 0) {
                    throw new Error("FAIL: block payload must be non-empty Uint8Array");
                }

                const absoluteTimecode = clusterTimecode + block.relativeTimecode;
                let stats = statsByTrack.get(block.trackNumber);
                if (!stats) {
                    stats = {
                        count: 0,
                        keyframes: 0,
                        lastTimecode: null,
                        nonMonotonicCount: 0
                    };
                    statsByTrack.set(block.trackNumber, stats);
                }

                stats.count += 1;
                if (block.keyframe) {
                    stats.keyframes += 1;
                }
                if (stats.lastTimecode !== null && absoluteTimecode < stats.lastTimecode) {
                    stats.nonMonotonicCount += 1;
                }
                stats.lastTimecode = absoluteTimecode;
            }
        }
    }

    const videoStats = statsByTrack.get(videoTrack.trackNumber);
    const audioStats = statsByTrack.get(audioTrack.trackNumber);
    assertExists("video simple block stats", videoStats);
    assertExists("audio simple block stats", audioStats);

    assertEqual("video simple block count", videoStats.count, 60);
    assertEqual("video keyframe count", videoStats.keyframes, 2);
    assertEqual("video non-monotonic count", videoStats.nonMonotonicCount, 0);

    assertEqual("audio simple block count", audioStats.count, 101);
    assertEqual("audio non-monotonic count", audioStats.nonMonotonicCount, 0);
}

export const WEBM_EXTRACTOR_TESTS = [
    test_webm_extractSegmentInfo_fromReferenceFixture,
    test_webm_extractTrackEntry_fromReferenceFixture,
    test_webm_extractSimpleBlock_countsAndTiming_fromReferenceFixture
];
