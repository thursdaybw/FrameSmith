import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

import { listTracksFromMp4 } from "../../demux/container/listTracksFromMp4.js";
import { extractTrackCodecConfigurationFromMp4 } from "../../demux/container/extractTrackCodecConfigurationFromMp4.js";
import { extractTrackContainerMetadataFromMp4 } from "../../demux/container/extractTrackContainerMetadataFromMp4.js";
import { extractSemanticAccessUnitsFromMp4 } from "../../demux/container/extractSemanticAccessUnitsFromMp4.js";

const require = createRequire(import.meta.url);
const MP4Box = require("../../../../../vendor/mp4box.js/dist/mp4box.all.cjs");

function normalizeNativeUnitsToUs({ units, trackTimescale }) {
    return units.map((unit) => ({
        ptsUs: Math.round((unit.pts / trackTimescale) * 1_000_000),
        dtsUs: Math.round(((typeof unit.dts === "number" ? unit.dts : unit.pts) / trackTimescale) * 1_000_000),
        durationUs: Math.round((unit.duration / trackTimescale) * 1_000_000),
        isKey: unit.isKey === true
    }));
}

function assertNonDecreasing(values, label) {
    for (let i = 1; i < values.length; i++) {
        if (values[i] < values[i - 1]) {
            throw new Error(`${label} must be non-decreasing (idx ${i - 1} -> ${i}, ${values[i - 1]} -> ${values[i]})`);
        }
    }
}

function span(summary) {
    if (summary.length === 0) return null;
    return summary[summary.length - 1] - summary[0];
}

function countKeys(units) {
    return units.reduce((sum, unit) => sum + (unit.isKey ? 1 : 0), 0);
}

function assertUnitsParity({ nativeUnits, mp4boxUnits, label, toleranceUs = 1 }) {
    if (nativeUnits.length !== mp4boxUnits.length) {
        throw new Error(`${label}: sample count mismatch native=${nativeUnits.length} mp4box=${mp4boxUnits.length}`);
    }

    for (let i = 0; i < nativeUnits.length; i++) {
        const nativeUnit = nativeUnits[i];
        const mp4boxUnit = mp4boxUnits[i];

        const ptsDelta = Math.abs(nativeUnit.ptsUs - mp4boxUnit.ptsUs);
        const dtsDelta = Math.abs(nativeUnit.dtsUs - mp4boxUnit.dtsUs);
        const durationDelta = Math.abs(nativeUnit.durationUs - mp4boxUnit.durationUs);
        const keyParity = nativeUnit.isKey === mp4boxUnit.isKey;

        if (ptsDelta > toleranceUs || dtsDelta > toleranceUs || durationDelta > toleranceUs || !keyParity) {
            throw new Error(
                `${label}: sample mismatch at index ${i} ` +
                `(pts native=${nativeUnit.ptsUs} mp4box=${mp4boxUnit.ptsUs}, ` +
                `dts native=${nativeUnit.dtsUs} mp4box=${mp4boxUnit.dtsUs}, ` +
                `duration native=${nativeUnit.durationUs} mp4box=${mp4boxUnit.durationUs}, ` +
                `isKey native=${nativeUnit.isKey} mp4box=${mp4boxUnit.isKey})`
            );
        }
    }
}

async function demuxWithMp4Box({ mp4Bytes }) {
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
        }, 10_000);

        const finalize = () => {
            if (done) return;
            if (typeof expectedVideoSamples !== "number") return;
            if (videoSamples.length < expectedVideoSamples) return;
            if (audioSamples.length < expectedAudioSamples) return;

            done = true;
            clearTimeout(timeoutId);
            resolve({
                videoSamples,
                audioSamples,
                videoTrack,
                audioTrack
            });
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
    const fixturePath = new URL("../reference/phone_test.mp4", import.meta.url);

    let mp4Bytes;
    try {
        mp4Bytes = await fs.readFile(fixturePath);
    } catch {
        console.log("SKIP test_nativeDemux_vs_mp4box_phoneFixture (missing fixture)", {
            expectedPath: String(fixturePath)
        });
        return { skipped: true };
    }

    const mp4Uint8 = new Uint8Array(mp4Bytes.buffer, mp4Bytes.byteOffset, mp4Bytes.byteLength);

    const tracks = listTracksFromMp4({ mp4Bytes: mp4Uint8 });
    let nativeVideo = null;
    let nativeAudio = null;

    for (const track of tracks) {
        const trackIndex = track.zeroBasedTrackIndex;
        const codecConfig = extractTrackCodecConfigurationFromMp4({
            mp4Bytes: mp4Uint8,
            zeroBasedTrackIndex: trackIndex
        });

        const metadata = extractTrackContainerMetadataFromMp4({
            mp4Bytes: mp4Uint8,
            zeroBasedTrackIndex: trackIndex
        });

        const units = extractSemanticAccessUnitsFromMp4({
            mp4Bytes: mp4Uint8,
            zeroBasedTrackIndex: trackIndex
        });

        if (/^avc/i.test(codecConfig.codec ?? "")) {
            nativeVideo = normalizeNativeUnitsToUs({
                units,
                trackTimescale: metadata.trackTimescale
            });
        } else {
            nativeAudio = normalizeNativeUnitsToUs({
                units,
                trackTimescale: metadata.trackTimescale
            });
        }
    }

    if (!nativeVideo || !nativeAudio) {
        throw new Error("native demux did not expose both video and audio tracks");
    }

    const mp4box = await demuxWithMp4Box({ mp4Bytes: mp4Uint8 });
    const mp4boxVideo = mp4box.videoSamples;
    const mp4boxAudio = mp4box.audioSamples;

    const report = {
        fixturePath,
        native: {
            videoCount: nativeVideo.length,
            audioCount: nativeAudio.length,
            videoKeyCount: countKeys(nativeVideo),
            audioKeyCount: countKeys(nativeAudio),
            videoSpanUs: span(nativeVideo.map((unit) => unit.ptsUs)),
            audioSpanUs: span(nativeAudio.map((unit) => unit.ptsUs))
        },
        mp4box: {
            videoCount: mp4boxVideo.length,
            audioCount: mp4boxAudio.length,
            videoKeyCount: countKeys(mp4boxVideo),
            audioKeyCount: countKeys(mp4boxAudio),
            videoSpanUs: span(mp4boxVideo.map((unit) => unit.ptsUs)),
            audioSpanUs: span(mp4boxAudio.map((unit) => unit.ptsUs))
        }
    };

    console.log("[DemuxParity][phone_fixture] summary JSON", JSON.stringify(report));

    assertNonDecreasing(nativeVideo.map((unit) => unit.dtsUs), "native.video.dts");
    assertNonDecreasing(nativeAudio.map((unit) => unit.dtsUs), "native.audio.dts");
    assertNonDecreasing(mp4boxVideo.map((unit) => unit.dtsUs), "mp4box.video.dts");
    assertNonDecreasing(mp4boxAudio.map((unit) => unit.dtsUs), "mp4box.audio.dts");

    if (nativeVideo.length !== mp4boxVideo.length) {
        throw new Error(`video sample count mismatch native=${nativeVideo.length} mp4box=${mp4boxVideo.length}`);
    }

    if (nativeAudio.length !== mp4boxAudio.length) {
        throw new Error(`audio sample count mismatch native=${nativeAudio.length} mp4box=${mp4boxAudio.length}`);
    }

    if (countKeys(nativeVideo) !== countKeys(mp4boxVideo)) {
        throw new Error(`video keyframe count mismatch native=${countKeys(nativeVideo)} mp4box=${countKeys(mp4boxVideo)}`);
    }

    assertUnitsParity({
        nativeUnits: nativeVideo,
        mp4boxUnits: mp4boxVideo,
        label: "video unit parity"
    });
    assertUnitsParity({
        nativeUnits: nativeAudio,
        mp4boxUnits: mp4boxAudio,
        label: "audio unit parity"
    });

    const nativeVideoSpan = span(nativeVideo.map((unit) => unit.ptsUs));
    const mp4boxVideoSpan = span(mp4boxVideo.map((unit) => unit.ptsUs));
    if (typeof nativeVideoSpan === "number" && typeof mp4boxVideoSpan === "number") {
        const delta = Math.abs(nativeVideoSpan - mp4boxVideoSpan);
        if (delta > 50_000) {
            throw new Error(`video span mismatch native=${nativeVideoSpan} mp4box=${mp4boxVideoSpan} delta=${delta}`);
        }
    }

    const nativeAudioSpan = span(nativeAudio.map((unit) => unit.ptsUs));
    const mp4boxAudioSpan = span(mp4boxAudio.map((unit) => unit.ptsUs));
    if (typeof nativeAudioSpan === "number" && typeof mp4boxAudioSpan === "number") {
        const delta = Math.abs(nativeAudioSpan - mp4boxAudioSpan);
        if (delta > 50_000) {
            throw new Error(`audio span mismatch native=${nativeAudioSpan} mp4box=${mp4boxAudioSpan} delta=${delta}`);
        }
    }

    return { skipped: false };
}
