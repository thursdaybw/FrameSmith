import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const MP4Box = require("../vendor/mp4box.js/dist/mp4box.all.cjs");

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

function getAvcCBufferFromMoov({ moov, videoTrackId }) {
    const trak = moov?.traks?.find((track) => track?.tkhd?.track_id === videoTrackId);
    const avcC = trak?.mdia?.minf?.stbl?.stsd?.entries?.[0]?.avcC;
    if (!avcC) return null;

    const total = avcC.size - avcC.hdr_size;
    const out = new Uint8Array(total);
    let offset = 0;
    out[offset++] = avcC.configurationVersion;
    out[offset++] = avcC.AVCProfileIndication;
    out[offset++] = avcC.profile_compatibility;
    out[offset++] = avcC.AVCLevelIndication;
    out[offset++] = (avcC.lengthSizeMinusOne & 0x03) | 0xFC;
    out[offset++] = (avcC.nb_SPS_nalus & 0x1F) | 0xE0;
    for (const sps of avcC.SPS) {
        out[offset++] = (sps.length >>> 8) & 0xFF;
        out[offset++] = sps.length & 0xFF;
        out.set(sps.data, offset);
        offset += sps.length;
    }
    out[offset++] = avcC.nb_PPS_nalus;
    for (const pps of avcC.PPS) {
        out[offset++] = (pps.length >>> 8) & 0xFF;
        out[offset++] = pps.length & 0xFF;
        out.set(pps.data, offset);
        offset += pps.length;
    }
    if (avcC.ext && avcC.ext.length > 0) {
        out.set(avcC.ext, offset);
    }
    return out;
}

async function runMp4BoxDemux({ mp4Buffer }) {
    return new Promise((resolve, reject) => {
        const mp4boxFile = MP4Box.createFile(true);
        const videoSamples = [];
        const audioSamples = [];
        let info = null;
        let videoTrackId = null;
        let audioTrackId = null;
        let expectedVideoSamples = null;
        let expectedAudioSamples = 0;
        let resolved = false;
        const timeoutId = setTimeout(() => {
            settle(reject, new Error("mp4box demux timeout: onReady/onSamples did not complete"));
        }, 5000);

        const settle = (fn, value) => {
            if (resolved) return;
            resolved = true;
            clearTimeout(timeoutId);
            fn(value);
        };

        mp4boxFile.onError = (error) => {
            settle(reject, new Error(`mp4box error: ${error}`));
        };

        mp4boxFile.onReady = (readyInfo) => {
            try {
                info = readyInfo;
                const videoTrack = readyInfo?.videoTracks?.[0];
                const audioTrack = readyInfo?.audioTracks?.[0];
                if (!videoTrack) {
                    settle(reject, new Error("mp4box demux: video track not found"));
                    return;
                }
                videoTrackId = videoTrack.id;
                audioTrackId = audioTrack?.id ?? null;
                expectedVideoSamples = videoTrack.nb_samples;
                expectedAudioSamples = audioTrack?.nb_samples ?? 0;

                console.log("[IsolatedDemux][mp4box-node] onReady", JSON.stringify({
                    videoTrackId,
                    audioTrackId,
                    expectedVideoSamples,
                    expectedAudioSamples
                }));

                mp4boxFile.setExtractionOptions(videoTrackId, null, { nbSamples: expectedVideoSamples });
                if (audioTrackId !== null) {
                    mp4boxFile.setExtractionOptions(audioTrackId, null, { nbSamples: expectedAudioSamples });
                }

                mp4boxFile.start();
                mp4boxFile.flush();
            } catch (error) {
                settle(reject, error);
            }
        };

        mp4boxFile.onSamples = (trackId, _user, samples) => {
            for (const sample of samples) {
                const timescale = sample.timescale;
                const timestampUs = Math.round((sample.cts / timescale) * 1_000_000);
                const durationUs = Math.round((sample.duration / timescale) * 1_000_000);
                const dtsUs = Math.round(((typeof sample.dts === "number" ? sample.dts : sample.cts) / timescale) * 1_000_000);
                const normalized = {
                    type: sample.is_sync ? "key" : "delta",
                    timestamp: timestampUs,
                    duration: durationUs,
                    cts: timestampUs,
                    dts: dtsUs,
                    data: new Uint8Array(sample.data),
                    raw: sample
                };
                if (trackId === videoTrackId) videoSamples.push(normalized);
                if (trackId === audioTrackId) audioSamples.push(normalized);
            }

            const doneVideo =
                typeof expectedVideoSamples === "number" &&
                videoSamples.length >= expectedVideoSamples;
            const doneAudio =
                typeof expectedAudioSamples === "number" &&
                audioSamples.length >= expectedAudioSamples;

            if (doneVideo && doneAudio) {
                const avcC = getAvcCBufferFromMoov({ moov: mp4boxFile.moov, videoTrackId });
                const audioEsds = mp4boxFile.moov?.traks
                    ?.find(track => track?.tkhd?.track_id === audioTrackId)
                    ?.mdia?.minf?.stbl?.stsd?.entries?.[0]?.esds ?? null;
                settle(resolve, {
                    info,
                    videoSamples,
                    audioSamples,
                    avcC,
                    audioEsds
                });
            }
        };

        const appendBuffer = mp4Buffer.slice(0);
        appendBuffer.fileStart = 0;
        mp4boxFile.appendBuffer(appendBuffer, true);
    });
}

async function runNativeDemux({ mp4Bytes }) {
    const [{ listTracksFromMp4 }, { extractTrackDataForNativeDemux }] = await Promise.all([
        import("../src/mux/native/demux/container/listTracksFromMp4.js"),
        import("../src/mux/native/demux/track/extractTrackDataForNativeDemux.js")
    ]);

    const tracks = listTracksFromMp4({ mp4Bytes });
    const trackData = tracks.map((track) =>
        extractTrackDataForNativeDemux({
            mp4Bytes,
            zeroBasedTrackIndex: track.zeroBasedTrackIndex
        })
    );

    const videoTrack = trackData.find((track) => track.type === "video");
    const audioTrack = trackData.find((track) => track.type === "audio");
    if (!videoTrack) throw new Error("native demux: video track not found");
    if (!audioTrack) throw new Error("native demux: audio track not found");

    return {
        videoTrack,
        audioTrack,
        videoSamples: normalizeNativeUnitsToEncodedSampleLike({
            units: videoTrack.accessUnits,
            mp4Bytes,
            trackTimescale: videoTrack.container.trackTimescale
        }),
        audioSamples: normalizeNativeUnitsToEncodedSampleLike({
            units: audioTrack.accessUnits,
            mp4Bytes,
            trackTimescale: audioTrack.container.trackTimescale
        })
    };
}

async function main() {
    const defaultPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../test.mp4");
    const srcPath = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : defaultPath;
    console.log("[IsolatedDemux] run start", JSON.stringify({ srcPath }));

    const fileBuffer = await fs.readFile(srcPath);
    const arrayBuffer = fileBuffer.buffer.slice(
        fileBuffer.byteOffset,
        fileBuffer.byteOffset + fileBuffer.byteLength
    );
    const mp4Bytes = new Uint8Array(arrayBuffer);

    const mp4box = await runMp4BoxDemux({ mp4Buffer: arrayBuffer });
    logDemuxDump({
        label: "mp4box",
        videoSamples: mp4box.videoSamples,
        audioSamples: mp4box.audioSamples,
        codecConfig: {
            videoTrackCodec: mp4box.info?.videoTracks?.[0]?.codec ?? null,
            videoTrackTimescale: mp4box.info?.videoTracks?.[0]?.timescale ?? null,
            avcCByteLength: mp4box.avcC?.length ?? 0,
            avcCFirst16Hex: firstBytesHex(mp4box.avcC, 16),
            audioTrackCodec: mp4box.info?.audioTracks?.[0]?.codec ?? null,
            audioTrackTimescale: mp4box.info?.audioTracks?.[0]?.timescale ?? null,
            audioEsdsByteLength: mp4box.audioEsds instanceof Uint8Array ? mp4box.audioEsds.length : 0,
            audioEsdsFirst16Hex: firstBytesHex(mp4box.audioEsds, 16)
        }
    });

    const native = await runNativeDemux({ mp4Bytes });
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

    console.log(
        "[IsolatedDemux][compare][mp4box-vs-native] timing JSON",
        JSON.stringify(
            compareDemuxes({
                mp4boxVideo: mp4box.videoSamples,
                nativeVideo: native.videoSamples,
                mp4boxAudio: mp4box.audioSamples,
                nativeAudio: native.audioSamples
            })
        )
    );
}

main().catch((error) => {
    console.error("[IsolatedDemux] run failed", error);
    process.exitCode = 1;
});
