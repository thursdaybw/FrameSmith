/**
 * WebCodecs Test Client
 * ====================
 *
 * Supplies a Mp4BuildInput by running WebCodecs and mapping
 * encoder-emitted facts into the compiler input contract.
 *
 * This is NOT production code.
 * This client simulates an application using WebCodecs.
 *
 * FUTURE STRESS PROBES (NOT RUN BY DEFAULT)
 * ========================================
 *
 * The following stress tests are intentionally NOT executed yet.
 * They are recorded here to capture known high-value probes that
 * uncover semantic and container-boundary bugs.
 *
 * These probes are orthogonal to duration stress and can be
 * activated later using small, local changes to this test client.
 *
 * ------------------------------------------------------------------
 * 1. Timescale Variation
 * ------------------------------------------------------------------
 *
 * Vary buildParameters.trackTimescale independently of fps.
 *
 * Examples:
 *   - 1000
 *   - 90000
 *   - 44100
 *   - prime values (e.g. 10007)
 *
 * Purpose:
 *   - Stress integer math paths
 *   - Reveal hidden divisibility assumptions
 *   - Validate mdhd / mvhd / stts coherence under awkward scales
 *
 * This test does NOT require visual inspection.
 *
 * ------------------------------------------------------------------
 * 2. Non-zero Start PTS
 * ------------------------------------------------------------------
 *
 * Introduce a constant offset to the first access unit timestamp.
 *
 * Example:
 *   timestamp = baseOffset + (frameIndex / fps)
 *
 * Purpose:
 *   - Validate edit list correctness
 *   - Stress mediaStartTime handling
 *   - Ensure container timing remains correct when PTS ≠ 0
 *
 * This frequently reveals silent container bugs.
 *
 * ------------------------------------------------------------------
 * 3. Sparse Keyframes
 * ------------------------------------------------------------------
 *
 * Increase distance between keyframes (seconds, not frames).
 *
 * Purpose:
 *   - Stress stss table correctness
 *   - Validate seekability under long GOPs
 *   - Ensure keyframe numbering remains stable over long durations
 *
 * No visual review required.
 *
 * ------------------------------------------------------------------
 * 4. Very Low FPS + Long Duration
 * ------------------------------------------------------------------
 *
 * Examples:
 *   - fps: 1–5
 *   - durationSeconds: 1–2 hours
 *
 * Purpose:
 *   - Stress extremely large sample_delta values
 *   - Probe integer bounds from the opposite direction of high-fps tests
 *   - Validate long-duration correctness with minimal sample counts
 *
 * This is complementary to high-fps stress tests.
 *
 * ------------------------------------------------------------------
 * NOTE
 * ------------------------------------------------------------------
 *
 * These probes are intentionally deferred.
 * Duration-based stress tests take priority.
 *
 * This section exists to preserve hard-won insight and ensure
 * future stress testing explores *assumption boundaries*, not
 * just scale.
 */

import {
   runWebCodecsRunner,
   createDeterministicCountdownFrameGenerator,
}
from "../webcodecs/runWebCodecsRunner.js"

import {
   runWebCodecsAudioRunner
}
from "../webcodecs/runWebCodecsAudioRunner.js"

import {
   renderOscillatorAudioBuffer,
   createAudioDataFromAudioBuffer
}
from "../webcodecs/createDeterministicAudioSource.js";

export async function runWebCodecsAudioVideoTestClient({
    mediaRecorderSink
} = {}) {

    const trackTimescale = 1_000_000;

    /**
     * 1. Quick visual sanity (10 seconds)
     *
     * Use this to confirm motion, colours, countdown, scan bar.
     */
    const codecString = "avc1.4D401F"; // Main, Level 3.1 (✅ OK for 1280x720)
    const fps = 60;
    const codedWidth = 1280
    const codedHeight = 720;
    const frames = createDeterministicCountdownFrameGenerator({
        width: codedWidth,
        height: codedHeight,
        fps: fps,
        durationSeconds: 10
    });

    // ---------------------------------------------------------
    // Video encode (WebCodecs)
    // ---------------------------------------------------------

    const videoEncodeResult = await runWebCodecsRunner({
            codec: codecString, 
            width: codedWidth,
            height: codedHeight,
            bitrate: 500_000,
            framerate: fps,
            frames,
            mediaRecorderSink, // ← pass-through
        });

    const videoTrack = buildVideoTrackFromWebCodecs({
        webcodecsOutput: videoEncodeResult,
        buildParameters: {
            codedWidth,
            codedHeight,
            trackTimescale
        }
    });

    const audioBuffer = await renderOscillatorAudioBuffer({
            sampleRate: 48000,
            numberOfChannels: 2,
            durationSeconds: 10,
            frequencyHz: 440
        });

    const audioDataFrames = [
        createAudioDataFromAudioBuffer({
            audioBuffer,
            timestamp: 0
        })
    ];

    // ---------------------------------------------------------
    // Audio encode (WebCodecs)
    // ---------------------------------------------------------

    const audioEncodeResult =
        await runWebCodecsAudioRunner({
            codec: "opus",
            sampleRate: 48000,
            numberOfChannels: 2,
            bitrate: 128000,
            audioDataFrames
        });

    const audioTrack = buildAudioTrackFromWebCodecs({
        webcodecsOutput: audioEncodeResult,
        buildParameters: {
            trackTimescale,
            channelCount: audioBuffer.numberOfChannels,
            sampleRate: audioBuffer.sampleRate
        }
    });

    return {
        tracks: [
            videoTrack,
            audioTrack
        ]
    };

}


/**
 * Maps WebCodecs output into Mp4BuildInput.
 *
 * This client:
 *   - owns intent
 *   - supplies identity if desired
 *   - does not apply container policy
 */
function buildVideoTrackFromWebCodecs({
    webcodecsOutput,
    buildParameters,
    semanticHints,
    buildHints
}) {
    const { encodedChunks, decoderConfig } = webcodecsOutput;

    const accessUnits = [];
    const accessUnitPayloads = [];

    for (const chunk of encodedChunks) {
        const bytes = new Uint8Array(chunk.byteLength);
        chunk.copyTo(bytes);

        accessUnitPayloads.push(bytes);
        accessUnits.push({
            pts: chunk.timestamp,
            isKey: chunk.type === "key"
        });
    }

    return {
        semanticCore: {
            accessUnits,
            codec: {
                codec: decoderConfig.codec,
                avcC: new Uint8Array(decoderConfig.description),
                avcCCompleteness: "semantic"
            }
        },

        payloads: {
            accessUnitPayloads
        },

        semanticHints,
        buildParameters,
        buildHints
    };

}

function buildAudioTrackFromWebCodecs({
    webcodecsOutput,
    buildParameters,
}) {
    const { encodedChunks, decoderConfig } = webcodecsOutput;

    const accessUnits = [];
    const accessUnitPayloads = [];

    for (const chunk of encodedChunks) {
        const bytes = new Uint8Array(chunk.byteLength);
        chunk.copyTo(bytes);

        accessUnitPayloads.push(bytes);
        accessUnits.push({
            pts: chunk.timestamp,
            isKey: true // audio has no inter-frame dependency
        });
    }

    console.log(`webcodecs supplied access units`, accessUnits);

    const dOps = new Uint8Array(decoderConfig.description);
    console.log("webcodecs supplied dOps", dOps);

    let buildHints = {}
    
    buildHints.chunkingStrategy = "packetized";

    let semanticHints = {}
   
    return {

        semanticCore: {
            accessUnits,
            codec: {
                codec: decoderConfig.codec, // "opus"
                dOps 
            }
        },

        payloads: {
            accessUnitPayloads
        },

        semanticHints,
        buildParameters,
        buildHints
    };
}

