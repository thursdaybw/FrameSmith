import {
    listTracksFromMp4
} from "../demux/container/listTracksFromMp4.js";

import {
    extractTrackCodecConfigurationFromMp4
} from "../demux/container/extractTrackCodecConfigurationFromMp4.js";

import {
    extractTrackContainerMetadataFromMp4
} from "../demux/container/extractTrackContainerMetadataFromMp4.js";

import {
    extractSemanticAccessUnitsFromMp4
} from "../demux/container/extractSemanticAccessUnitsFromMp4.js";

import { assertEqual } from "./assertions.js";

function toUs({ value, timescale }) {
    return Math.round((value / timescale) * 1_000_000);
}

function countKeys(units) {
    return units.reduce((sum, unit) => sum + (unit.isKey ? 1 : 0), 0);
}

function spanByPtsUs(units) {
    if (!Array.isArray(units) || units.length === 0) return null;
    return units[units.length - 1].ptsUs - units[0].ptsUs;
}

async function demuxWithMp4Box({ mp4Bytes }) {
    if (typeof MP4Box === "undefined") {
        return null;
    }

    return await new Promise((resolve, reject) => {
        const mp4boxFile = MP4Box.createFile(true);
        const videoSamples = [];
        const audioSamples = [];
        let videoTrack = null;
        let audioTrack = null;
        let expectedVideoSamples = null;
        let expectedAudioSamples = 0;
        let done = false;

        const timeoutId = setTimeout(() => {
            if (done) return;
            done = true;
            reject(new Error("mp4box demux timeout"));
        }, 10000);

        const finalize = () => {
            if (done) return;
            if (typeof expectedVideoSamples !== "number") return;
            if (videoSamples.length < expectedVideoSamples) return;
            if (audioSamples.length < expectedAudioSamples) return;
            done = true;
            clearTimeout(timeoutId);
            resolve({ videoSamples, audioSamples });
        };

        mp4boxFile.onError = (error) => {
            if (done) return;
            done = true;
            clearTimeout(timeoutId);
            reject(new Error(`mp4box error: ${error}`));
        };

        mp4boxFile.onReady = (info) => {
            videoTrack = info?.videoTracks?.[0] ?? null;
            audioTrack = info?.audioTracks?.[0] ?? null;
            if (!videoTrack) {
                done = true;
                clearTimeout(timeoutId);
                reject(new Error("mp4box: missing video track"));
                return;
            }
            expectedVideoSamples = videoTrack.nb_samples;
            expectedAudioSamples = audioTrack?.nb_samples ?? 0;
            mp4boxFile.setExtractionOptions(videoTrack.id, null, { nbSamples: videoTrack.nb_samples });
            if (audioTrack) {
                mp4boxFile.setExtractionOptions(audioTrack.id, null, { nbSamples: audioTrack.nb_samples });
            }
        };

        mp4boxFile.onSamples = (trackId, _user, samples) => {
            for (const sample of samples) {
                const normalized = {
                    ptsUs: Math.round((sample.cts / sample.timescale) * 1_000_000),
                    dtsUs: Math.round(((typeof sample.dts === "number" ? sample.dts : sample.cts) / sample.timescale) * 1_000_000),
                    durationUs: Math.round((sample.duration / sample.timescale) * 1_000_000),
                    isKey: sample.is_sync === true
                };

                if (videoTrack && trackId === videoTrack.id) {
                    videoSamples.push(normalized);
                } else if (audioTrack && trackId === audioTrack.id) {
                    audioSamples.push(normalized);
                }
            }
            finalize();
        };

        const buffer = mp4Bytes.buffer.slice(
            mp4Bytes.byteOffset,
            mp4Bytes.byteOffset + mp4Bytes.byteLength
        );
        buffer.fileStart = 0;
        mp4boxFile.appendBuffer(buffer);
        mp4boxFile.start();
        mp4boxFile.flush();
    });
}

export async function test_nativeDemux_vs_mp4box_phoneFixture() {
    const resp = await fetch("reference/phone_test.mp4");

    if (!resp.ok) {
        console.log("SKIP test_nativeDemux_vs_mp4box_phoneFixture (missing fixture reference/phone_test.mp4)");
        return;
    }

    if (typeof MP4Box === "undefined") {
        console.log("SKIP test_nativeDemux_vs_mp4box_phoneFixture (MP4Box global missing)");
        return;
    }

    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    const tracks = listTracksFromMp4({ mp4Bytes });
    let nativeVideo = null;
    let nativeAudio = null;

    for (const track of tracks) {
        const zeroBasedTrackIndex = track.zeroBasedTrackIndex;
        const codecConfig = extractTrackCodecConfigurationFromMp4({
            mp4Bytes,
            zeroBasedTrackIndex
        });
        const metadata = extractTrackContainerMetadataFromMp4({
            mp4Bytes,
            zeroBasedTrackIndex
        });
        const units = extractSemanticAccessUnitsFromMp4({
            mp4Bytes,
            zeroBasedTrackIndex
        });

        const normalized = units.map((unit) => ({
            ptsUs: toUs({ value: unit.pts, timescale: metadata.trackTimescale }),
            dtsUs: toUs({ value: (typeof unit.dts === "number" ? unit.dts : unit.pts), timescale: metadata.trackTimescale }),
            durationUs: toUs({ value: unit.duration, timescale: metadata.trackTimescale }),
            isKey: unit.isKey === true
        }));

        if (/^avc/i.test(codecConfig.codec ?? "")) {
            nativeVideo = normalized;
        } else {
            nativeAudio = normalized;
        }
    }

    const mp4box = await demuxWithMp4Box({ mp4Bytes });
    const mp4boxVideo = mp4box.videoSamples;
    const mp4boxAudio = mp4box.audioSamples;

    assertEqual("video sample count parity", nativeVideo.length, mp4boxVideo.length);
    assertEqual("audio sample count parity", nativeAudio.length, mp4boxAudio.length);
    assertEqual("video key count parity", countKeys(nativeVideo), countKeys(mp4boxVideo));

    const nativeVideoSpan = spanByPtsUs(nativeVideo);
    const mp4boxVideoSpan = spanByPtsUs(mp4boxVideo);
    const nativeAudioSpan = spanByPtsUs(nativeAudio);
    const mp4boxAudioSpan = spanByPtsUs(mp4boxAudio);

    if (typeof nativeVideoSpan === "number" && typeof mp4boxVideoSpan === "number") {
        assertEqual(
            "video span parity within 50ms",
            Math.abs(nativeVideoSpan - mp4boxVideoSpan) <= 50_000,
            true
        );
    }

    if (typeof nativeAudioSpan === "number" && typeof mp4boxAudioSpan === "number") {
        assertEqual(
            "audio span parity within 50ms",
            Math.abs(nativeAudioSpan - mp4boxAudioSpan) <= 50_000,
            true
        );
    }
}
