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

export async function runWebCodecsTestClient() {

    /**
     * AVC codec string reference (WebCodecs)
     * =====================================
     *
     * Format:
     *
     *   avc1.PP LL SS
     *
     * Where:
     *   PP = profile_idc (hex)
     *        0x42 = Baseline
     *        0x4D = Main
     *        0x64 = High
     *
     *   LL SS together encode constraint flags + level
     *
     * Common levels (hex → decimal):
     *   0x1E = Level 3.0
     *   0x1F = Level 3.1
     *   0x28 = Level 4.0
     *
     * Practical guidance for this test client:
     *
     * - Level 3.0 is too small for 1280x720 and will be rejected by WebCodecs
     * - Level 3.1 is the safe, conservative choice for 720p
     * - Level 4.0+ is unnecessary here and may reduce browser support
     *
     * NOTE:
     * - Level affects ONLY the WebCodecs encoder
     * - Profile affects BOTH WebCodecs and the MP4 compiler
     *   (High profile triggers avcC container-completion policy)
     */

    // ---------------------------------------------------------
    // Baseline Profile (widest compatibility)
    // ---------------------------------------------------------

    // const codecString = "avc1.42E01E"; // Baseline, Level 3.0 (❌ too small for 1280x720)
    // const codecString = "avc1.42E01F"; // Baseline, Level 3.1 (✅ OK for 1280x720)

    // ---------------------------------------------------------
    // Main Profile (still broadly compatible)
    // ---------------------------------------------------------

    // const codecString = "avc1.4D401E"; // Main, Level 3.0 (❌ too small for 1280x720)
    // ** const codecString = "avc1.4D401F"; // Main, Level 3.1 (✅ OK for 1280x720)

    // ---------------------------------------------------------
    // High Profile (exercises avcC container policy)
    // ---------------------------------------------------------

    // const codecString = "avc1.64001E"; // High, Level 3.0 (❌ too small for 1280x720)
    // const codecString = "avc1.64001F"; // High, Level 3.1 (✅ OK for 1280x720, triggers avcC completion)

    // ---------------------------------------------------------
    // Higher levels (NOT recommended here)
    // ---------------------------------------------------------

    // const codecString = "avc1.42E028"; // Baseline, Level 4.0 (⚠ unnecessary for this test)
    // const codecString = "avc1.640028"; // High, Level 4.0 (⚠ unnecessary, less browser-friendly)

    //const codecString = "avc1.64002A"; // High Profile, Level 4.2 (1080p60)

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

    /**
     * 2. One-minute correctness check (recommended first real run)
     * This is the baseline human-reviewable test.
     *
     * Watch for:
     * - smooth scan bar
     * - colour changes every few seconds
     * - countdown hits 00:00 exactly
     * - no stutter or jump
    const codedWidth = 1280
    const codedHeight = 720;
    const fps = 60;
    const frames = createDeterministicCountdownFrameGenerator({
        width: codedHeight,
        height: codedWidth,
        fps: fps,
        durationSeconds: 60
    });
     */

    /**
     * 3. Ten-minute sustained test
     *
     * This is where accumulation bugs show up.
    const codedWidth = 1280
    const codedHeight = 720;
    const fps = 60;
    const frames = createDeterministicCountdownFrameGenerator({
        width: codedHeight,
        height: codedWidth,
        fps: fps,
        durationSeconds: 600, // 10 minutes
        milestoneSeconds: 300 // flash every 5 minutes
    });
    const fps = 60;
    const frames = createDeterministicCountdownFrameGenerator({
        width: codedWidth,
        height: codedHeight,
        fps,
        durationSeconds: 600
    });
     */

    /**
     * 4. One-hour stress test (serious)
     *
     * Lower fps to reduce memory pressure while keeping semantics intact.
    const fps = 24;
    const codedWidth = 1280
    const codedHeight = 720;
    const frames = createDeterministicCountdownFrameGenerator({
        width: codedWidth,
        height: codedHeight,
        fps: fps,
        durationSeconds: 3600, // 1 hour
    });
     */

    /**
     * 5. Absurd duration (architecture probe)
     *
     * This is not about watching the whole thing.
     * It’s about whether anything breaks.
    const fps = 12;
    const codedWidth = 854;
    const codedHeight = 480;
    const frames = createDeterministicCountdownFrameGenerator({
        width: codedWidth,
        height: codedHeight,
        fps: fps,
        durationSeconds: 7200, // 2 hours
    });
    frames.totalFrames = fps * 7200;
     */

    /*
    const fps = 60;
    const codedWidth = 1920;
    const codedHeight = 1080;
    const frames = createDeterministicCountdownFrameGenerator({
        width: codedWidth,
        height: codedHeight,
        fps,
        durationSeconds: 300, // 5 minutes
    });
    frames.totalFrames = fps * 300;

    const fps = 6;
    const codedWidth = 3840;
    const codedHeight = 2160;

    const codecString = "avc1.640033"; // High, Level 5.1

    const frames = createDeterministicCountdownFrameGenerator({
        width: codedWidth,
        height: codedHeight,
        fps,
        durationSeconds: 300 // 5 minutes
    });
    frames.totalFrames = fps * 300;

    const codecString = "avc1.640033"; // High Profile, Level 5.1 (REQUIRED for 4K60)
    const fps = 60;
    const codedWidth = 3840;
    const codedHeight = 2160;

    const frames = createDeterministicCountdownFrameGenerator({
        width: codedWidth,
        height: codedHeight,
        fps,
        durationSeconds: 600, // 1 full minute, not a toy
    });
    frames.totalFrames = fps * 600;
    */

    const webcodecsOutput =
        await runWebCodecsRunner({
            codec: codecString, 
            width: codedWidth,
            height: codedHeight,
            bitrate: 500_000,
            framerate: fps,
            frames
        });

    return buildMp4BuildInputFromWebCodecs({
        webcodecsOutput,
        buildParameters: {
            codedWidth,
            codedHeight,
            trackTimescale
        }
    });
}


/**
 * Maps WebCodecs output into Mp4BuildInput.
 *
 * This client:
 *   - owns intent
 *   - supplies identity if desired
 *   - does not apply container policy
 */
function buildMp4BuildInputFromWebCodecs({
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


