import { Mp4BoxDemuxer } from "../src/demux/Mp4BoxDemuxer.js";
import { listTracksFromMp4 } from "../vendor/native-mp4-muxer/demux/container/listTracksFromMp4.js";
import { extractTrackDataForNativeDemux } from "../vendor/native-mp4-muxer/demux/track/extractTrackDataForNativeDemux.js";

function toHexByte(value) {
    return value.toString(16).padStart(2, "0").toUpperCase();
}

function firstBytesHex(data, count = 16) {
    if (!(data instanceof Uint8Array)) return "";
    const limit = Math.min(count, data.length);
    const out = [];
    for (let i = 0; i < limit; i++) out.push(toHexByte(data[i]));
    return out.join(" ");
}

function inferPayloadFormat(data) {
    if (!(data instanceof Uint8Array) || data.length < 4) return "unknown";
    if (data[0] === 0x00 && data[1] === 0x00 && data[2] === 0x01) return "annexb";
    if (data[0] === 0x00 && data[1] === 0x00 && data[2] === 0x00 && data[3] === 0x01) return "annexb";
    return "avcc";
}

function readAvccNalLengthAt(data, offset) {
    if (!(data instanceof Uint8Array)) return null;
    if (offset + 4 > data.length) return null;
    return (
        (data[offset] << 24) |
        (data[offset + 1] << 16) |
        (data[offset + 2] << 8) |
        data[offset + 3]
    ) >>> 0;
}

function walkAvccNals(data) {
    const payloadFormat = inferPayloadFormat(data);
    if (payloadFormat !== "avcc") {
        return {
            payloadFormat,
            nalCount: 0,
            nalTypes: [],
            hasVcl: false,
            hasIdr: false,
            malformed: false,
            malformedReason: null
        };
    }

    const nalTypes = [];
    let offset = 0;
    let malformed = false;
    let malformedReason = null;
    let hasVcl = false;
    let hasIdr = false;

    while (offset < data.length) {
        const nalLength = readAvccNalLengthAt(data, offset);
        if (nalLength === null) {
            malformed = true;
            malformedReason = "truncated-length-prefix";
            break;
        }
        offset += 4;
        if (nalLength <= 0) {
            malformed = true;
            malformedReason = "zero-length-nal";
            break;
        }
        if (offset + nalLength > data.length) {
            malformed = true;
            malformedReason = "nal-overruns-payload";
            break;
        }
        const nalType = data[offset] & 0x1f;
        nalTypes.push(nalType);
        if (nalType >= 1 && nalType <= 5) hasVcl = true;
        if (nalType === 5) hasIdr = true;
        offset += nalLength;
    }

    return {
        payloadFormat,
        nalCount: nalTypes.length,
        nalTypes,
        hasVcl,
        hasIdr,
        malformed,
        malformedReason
    };
}

function summarizeTiming(units) {
    if (!Array.isArray(units) || units.length === 0) {
        return { count: 0 };
    }

    const timestamps = units
        .map(unit => unit?.timestamp)
        .filter(value => typeof value === "number");
    const durations = units
        .map(unit => unit?.duration)
        .filter(value => typeof value === "number");

    const deltas = [];
    for (let i = 1; i < timestamps.length; i++) {
        deltas.push(timestamps[i] - timestamps[i - 1]);
    }

    const uniqueDeltas = [...new Set(deltas)];
    const keyCount = units.filter(unit => unit?.type === "key").length;

    return {
        count: units.length,
        firstTimestampUs: timestamps[0] ?? null,
        lastTimestampUs: timestamps[timestamps.length - 1] ?? null,
        minDurationUs: durations.length ? Math.min(...durations) : null,
        maxDurationUs: durations.length ? Math.max(...durations) : null,
        uniqueDeltaCount: uniqueDeltas.length,
        first10DeltasUs: deltas.slice(0, 10),
        keyCount,
        deltaCount: units.length - keyCount
    };
}

function summarizeVideoNal(units) {
    let avccCount = 0;
    let annexbCount = 0;
    let malformedCount = 0;
    let idrSampleCount = 0;
    let vclSampleCount = 0;

    for (const unit of units) {
        const report = walkAvccNals(unit?.data);
        if (report.payloadFormat === "avcc") avccCount++;
        if (report.payloadFormat === "annexb") annexbCount++;
        if (report.malformed) malformedCount++;
        if (report.hasIdr) idrSampleCount++;
        if (report.hasVcl) vclSampleCount++;
    }

    return {
        sampleCount: units.length,
        avccCount,
        annexbCount,
        malformedCount,
        idrSampleCount,
        vclSampleCount
    };
}

function normalizeNativeUnitsToEncodedSampleLike({ units, mp4Bytes, trackTimescale }) {
    if (!Array.isArray(units)) return [];
    return units.map((unit) => {
        const timestampUs = Math.round((unit.pts / trackTimescale) * 1_000_000);
        const durationUs = Math.round((unit.duration / trackTimescale) * 1_000_000);
        const dtsUs = Math.round(
            ((typeof unit.dts === "number" ? unit.dts : unit.pts) / trackTimescale) * 1_000_000
        );
        return {
            type: unit.isKey ? "key" : "delta",
            timestamp: timestampUs,
            duration: durationUs,
            cts: timestampUs,
            dts: dtsUs,
            data: mp4Bytes.slice(unit.offset, unit.offset + unit.size),
            raw: {
                pts: unit.pts,
                dts: unit.dts,
                duration: unit.duration,
                isKey: unit.isKey,
                timescale: trackTimescale,
                offset: unit.offset,
                size: unit.size
            }
        };
    });
}

function compareDemuxes({ mp4boxVideo, nativeVideo, mp4boxAudio, nativeAudio }) {
    const compareTiming = (lhs, rhs) => {
        const l = summarizeTiming(lhs);
        const r = summarizeTiming(rhs);
        return {
            countDelta: (l.count ?? 0) - (r.count ?? 0),
            firstTimestampDeltaUs:
                (typeof l.firstTimestampUs === "number" && typeof r.firstTimestampUs === "number")
                    ? l.firstTimestampUs - r.firstTimestampUs
                    : null,
            lastTimestampDeltaUs:
                (typeof l.lastTimestampUs === "number" && typeof r.lastTimestampUs === "number")
                    ? l.lastTimestampUs - r.lastTimestampUs
                    : null,
            uniqueDeltaCountLhs: l.uniqueDeltaCount ?? null,
            uniqueDeltaCountRhs: r.uniqueDeltaCount ?? null,
            first10DeltasLhs: l.first10DeltasUs ?? [],
            first10DeltasRhs: r.first10DeltasUs ?? []
        };
    };

    return {
        video: compareTiming(mp4boxVideo, nativeVideo),
        audio: compareTiming(mp4boxAudio, nativeAudio)
    };
}

function logDemuxDump({ label, videoSamples, audioSamples, codecConfig }) {
    console.log(
        `[IsolatedDemux][${label}] codec config JSON`,
        JSON.stringify(codecConfig)
    );

    console.log(
        `[IsolatedDemux][${label}] sample summary JSON`,
        JSON.stringify({
            video: summarizeTiming(videoSamples),
            audio: summarizeTiming(audioSamples),
            videoNal: summarizeVideoNal(videoSamples)
        })
    );

    const firstVideoSamples = videoSamples.slice(0, 10).map((sample, index) => {
        const raw = sample?.raw ?? {};
        return {
            index,
            type: sample?.type ?? null,
            timestampUs: sample?.timestamp ?? null,
            durationUs: sample?.duration ?? null,
            cts: raw?.cts ?? raw?.pts ?? sample?.cts ?? null,
            dts: raw?.dts ?? sample?.dts ?? null,
            timescale: raw?.timescale ?? null,
            is_sync: raw?.is_sync ?? raw?.isKey ?? null,
            dataByteLength: sample?.data?.length ?? null,
            first16Hex: firstBytesHex(sample?.data, 16),
            nal: walkAvccNals(sample?.data)
        };
    });

    console.log(
        `[IsolatedDemux][${label}] first video samples JSON`,
        JSON.stringify(firstVideoSamples)
    );

    const firstAudioSamples = audioSamples.slice(0, 10).map((sample, index) => {
        const raw = sample?.raw ?? {};
        return {
            index,
            type: sample?.type ?? null,
            timestampUs: sample?.timestamp ?? null,
            durationUs: sample?.duration ?? null,
            cts: raw?.cts ?? raw?.pts ?? sample?.cts ?? null,
            dts: raw?.dts ?? sample?.dts ?? null,
            timescale: raw?.timescale ?? null,
            is_sync: raw?.is_sync ?? raw?.isKey ?? null,
            dataByteLength: sample?.data?.length ?? null,
            first16Hex: firstBytesHex(sample?.data, 16)
        };
    });

    console.log(
        `[IsolatedDemux][${label}] first audio samples JSON`,
        JSON.stringify(firstAudioSamples)
    );
}

function runNativeDemux({ mp4Bytes }) {
    const tracks = listTracksFromMp4({ mp4Bytes });
    const trackData = tracks.map((track) =>
        extractTrackDataForNativeDemux({
            mp4Bytes,
            zeroBasedTrackIndex: track.zeroBasedTrackIndex
        })
    );

    const videoTrack = trackData.find((track) => track.type === "video");
    const audioTrack = trackData.find((track) => track.type === "audio");

    if (!videoTrack) {
        throw new Error("Native demux: video track not found");
    }
    if (!audioTrack) {
        throw new Error("Native demux: audio track not found");
    }

    const videoSamples = normalizeNativeUnitsToEncodedSampleLike({
        units: videoTrack.accessUnits,
        mp4Bytes,
        trackTimescale: videoTrack.container.trackTimescale
    });
    const audioSamples = normalizeNativeUnitsToEncodedSampleLike({
        units: audioTrack.accessUnits,
        mp4Bytes,
        trackTimescale: audioTrack.container.trackTimescale
    });

    return {
        videoTrack,
        audioTrack,
        videoSamples,
        audioSamples
    };
}

async function runDemux({ src }) {
    console.log("[IsolatedDemux] run start", { src });
    const response = await fetch(src);
    if (!response.ok) {
        throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const mp4Bytes = new Uint8Array(arrayBuffer);

    // mp4box demux
    const demuxer = new Mp4BoxDemuxer(arrayBuffer);
    const parsed = await demuxer.parse();

    const avcCBuffer = demuxer.getAvcCBuffer();
    const avcC = avcCBuffer instanceof ArrayBuffer ? new Uint8Array(avcCBuffer) : null;
    const audioEsds = demuxer.getAudioEsds();

    const videoSamples = Array.isArray(parsed?.videoSamples) ? parsed.videoSamples : [];
    const audioSamples = Array.isArray(parsed?.audioSamples) ? parsed.audioSamples : [];

    logDemuxDump({
        label: "mp4box",
        videoSamples,
        audioSamples,
        codecConfig: {
            videoTrackCodec: parsed?.videoTrack?.codec ?? null,
            videoTrackTimescale: parsed?.videoTrack?.timescale ?? null,
            avcCByteLength: avcC?.length ?? 0,
            avcCFirst16Hex: firstBytesHex(avcC, 16),
            audioTrackCodec: parsed?.audioTrack?.codec ?? null,
            audioTrackTimescale: parsed?.audioTrack?.timescale ?? null,
            audioEsdsByteLength: audioEsds instanceof Uint8Array ? audioEsds.length : 0,
            audioEsdsFirst16Hex: firstBytesHex(audioEsds, 16)
        }
    });

    // native demux
    const native = runNativeDemux({ mp4Bytes });
    logDemuxDump({
        label: "native",
        videoSamples: native.videoSamples,
        audioSamples: native.audioSamples,
        codecConfig: {
            videoTrackCodec: native.videoTrack.codecConfig?.codec ?? null,
            videoTrackTimescale: native.videoTrack.container?.trackTimescale ?? null,
            avcCByteLength: native.videoTrack.codecConfig?.avcC?.length ?? 0,
            avcCFirst16Hex: firstBytesHex(native.videoTrack.codecConfig?.avcC, 16),
            audioTrackCodec: native.audioTrack.codecConfig?.codec ?? null,
            audioTrackTimescale: native.audioTrack.container?.trackTimescale ?? null,
            audioEsdsByteLength: native.audioTrack.codecConfig?.esds?.length ?? 0,
            audioEsdsFirst16Hex: firstBytesHex(native.audioTrack.codecConfig?.esds, 16)
        }
    });

    // comparison
    console.log(
        "[IsolatedDemux][compare][mp4box-vs-native] timing JSON",
        JSON.stringify(
            compareDemuxes({
                mp4boxVideo: videoSamples,
                nativeVideo: native.videoSamples,
                mp4boxAudio: audioSamples,
                nativeAudio: native.audioSamples
            })
        )
    );

    return {
        parsed,
        native,
        avcC,
        audioEsds
    };
}

function setStatus(message) {
    const statusEl = document.getElementById("status");
    if (statusEl) statusEl.textContent = message;
}

function getSrcFromUiOrQuery() {
    const input = document.getElementById("srcInput");
    const fromUi = input?.value?.trim();
    const fromQuery = new URLSearchParams(window.location.search).get("src");
    const src = fromUi || fromQuery || "../test.mp4";
    if (input && !input.value) input.value = src;
    return src;
}

async function onRunClick() {
    const src = getSrcFromUiOrQuery();
    setStatus(`Running demux for: ${src}`);
    try {
        await runDemux({ src });
        setStatus(`Complete: ${src}. Check console logs.`);
    } catch (error) {
        console.error("[IsolatedDemux] run failed", error);
        setStatus(`Failed: ${error?.message ?? String(error)}`);
    }
}

window.addEventListener("DOMContentLoaded", () => {
    const runBtn = document.getElementById("runBtn");
    if (runBtn) {
        runBtn.addEventListener("click", onRunClick);
    }

    const querySrc = new URLSearchParams(window.location.search).get("src");
    if (querySrc) {
        const input = document.getElementById("srcInput");
        if (input) input.value = querySrc;
        onRunClick();
    }
});
