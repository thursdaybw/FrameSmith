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


export async function runWebCodecsTestClient() {

    //const codecString = "avc1.42E01E";
    //const codedWidth = 64;
    //const codedHeight = 64;

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
 * Runs WebCodecs and returns raw encoder output.
 * Knows NOTHING about MP4 or container structure.
 */
async function runWebCodecsRunner({
    codec,
    width,
    height,
    bitrate,
    framerate,
    frames
}) {
    const encodedChunks = [];
    let decoderConfig = null;

    const encoder = new VideoEncoder({
        output(chunk, meta) {
            encodedChunks.push(chunk);
            if (meta?.decoderConfig && decoderConfig === null) {
                decoderConfig = meta.decoderConfig;
            }
        },
        error(e) {
            throw e;
        }
    });

    encoder.configure({
        codec,
        width,
        height,
        bitrate,
        framerate
    });


    const startTimeMs = performance.now();
    let index = 0;

    // If frames is a generator, we still know totalFrames from the generator contract
    // Pass totalFrames explicitly when calling runWebCodecsRunner
    const totalFrames = frames.totalFrames;

    for (const frame of frames) {

        // --- backpressure ---
        while (encoder.encodeQueueSize > 30) {
            await new Promise(r => setTimeout(r, 0));
        }

        encoder.encode(frame);
        frame.close();

        index++;

        // -------------------------------------------------
        // Progress logging (once per second)
        // -------------------------------------------------
        if (index % framerate === 0) {
            const nowMs = performance.now();
            const elapsedMs = nowMs - startTimeMs;

            const progress = index / totalFrames;
            const percent = (progress * 100).toFixed(1);

            const estimatedTotalMs = elapsedMs / progress;
            const remainingMs = estimatedTotalMs - elapsedMs;

            console.log(
                `[ENCODE] ${percent}% ` +
                `(${index}/${totalFrames}) ` +
                `elapsed=${(elapsedMs / 1000).toFixed(1)}s ` +
                `eta=${(remainingMs / 1000).toFixed(1)}s`
            );
        }
    }


    await encoder.flush();
    encoder.close();

    return {
        encodedChunks,
        decoderConfig
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

/**
 * createDeterministicCountdownFrameGenerator
 * ==========================================
 *
 * Streaming, deterministic VideoFrame generator for stress-testing
 * WebCodecs encoders and MP4 container compilation.
 *
 * DESIGN GOALS
 * ------------
 * - Zero frame buffering (generator, not array)
 * - Deterministic output (frameIndex is the single source of truth)
 * - No floating accumulation
 * - No wall-clock dependence
 *
 * VISUAL SIGNALS
 * --------------
 * 1. Countdown timer (remaining time)
 * 2. Frame index watermark (absolute truth)
 * 3. Background color bands (elapsed-time sanity)
 * 4. Scan bar (motion + ordering verification)
 * 5. Periodic marker text (interval + duration based)
 *
 * MARKER BEHAVIOR
 * ---------------
 * - Marker appears every `markerSeconds`
 * - Marker remains visible for exactly 3 seconds
 * - Marker selection is deterministic (no Math.random)
 *
 * This generator exists to:
 * - Stress encoder backpressure
 * - Stress timestamp math
 * - Stress long-duration correctness
 *
 * If this breaks, the container math is wrong.
 */
export function* createDeterministicCountdownFrameGenerator({
    width,
    height,
    fps,
    durationSeconds,

    showMilliseconds = false,

    // Visual dynamics
    colorBandSeconds = 5,
    scanPeriodSeconds = 2,
    scanWidthRatio = 0.15,

    // Fun markers
    markerSeconds = 10
}) {
    const totalFrames = Math.floor(durationSeconds * fps);

    // -------------------------------------------------
    // Precomputed constants
    // -------------------------------------------------

    const frameDurationUs = Math.floor(1_000_000 / fps);

    const colorBandFrames = Math.floor(colorBandSeconds * fps);
    const scanPeriodFrames = Math.floor(scanPeriodSeconds * fps);
    const scanWidth = Math.floor(width * scanWidthRatio);

    const markerIntervalFrames =
        markerSeconds > 0
        ? Math.floor(markerSeconds * fps)
        : 0;

    const markerDurationFrames =
        Math.floor(3 * fps); // marker visible for 3 seconds

    // -------------------------------------------------
    // Visual assets
    // -------------------------------------------------

    const palette = [
        [255, 80, 80],
        [80, 255, 80],
        [80, 80, 255],
        [255, 255, 80],
        [255, 80, 255],
        [80, 255, 255]
    ];

    const phrases = [
        "Bevan was here",
        "Compile this",
        "MP4EVA",
        "JavaScript sux",
        "No floats",
        "Deterministic",
        "This is fine",
        "Mux it",
        "Count the frames",
        "Trust the math"
    ];

    // -------------------------------------------------
    // Frame loop
    // -------------------------------------------------

    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {

        // -----------------------------
        // Time math (single source)
        // -----------------------------

        const elapsedSeconds = frameIndex / fps;
        const remainingSeconds = Math.max(
            0,
            durationSeconds - elapsedSeconds
        );

        // -----------------------------
        // Countdown text
        // -----------------------------

        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = Math.floor(remainingSeconds % 60);
        const milliseconds = Math.floor(
            (remainingSeconds - Math.floor(remainingSeconds)) * 1000
        );

        const timeText = showMilliseconds
            ? `${pad2(minutes)}:${pad2(seconds)}.${pad3(milliseconds)}`
            : `${pad2(minutes)}:${pad2(seconds)}`;

        // -----------------------------
        // Background colour
        // -----------------------------

        const colorIndex =
            Math.floor(frameIndex / colorBandFrames) % palette.length;

        const backgroundColor = palette[colorIndex];

        // -----------------------------
        // Scan bar animation
        // -----------------------------

        const scanFrame = frameIndex % scanPeriodFrames;
        const scanPercent = scanFrame / scanPeriodFrames;

        const scanX = Math.floor(
            scanPercent * (width - scanWidth)
        );

        // -----------------------------
        // Marker text (interval + duration)
        // -----------------------------

        let markerText = null;

        if (markerIntervalFrames > 0 && frameIndex >= markerIntervalFrames) {
            const framesSinceMarker =
                frameIndex % markerIntervalFrames;

            if (framesSinceMarker < markerDurationFrames) {
                const markerIndex =
                    Math.floor(frameIndex / markerIntervalFrames);

                markerText =
                    phrases[markerIndex % phrases.length];
            }
        }

        // -----------------------------
        // Render
        // -----------------------------

        const canvas = createCanvasVideoFrame({
            width,
            height,
            backgroundColor,

            rectangles: [
                {
                    x: scanX,
                    y: Math.floor(height * 0.6),
                    width: scanWidth,
                    height: Math.floor(height * 0.05),
                    color: [0, 0, 0]
                }
            ],

            texts: [
                {
                    text: timeText,
                    x: width / 2,
                    y: height * 0.35,
                    fontSize: Math.floor(height * 0.15),
                    align: "center"
                },
                {
                    text: `F:${frameIndex}`,
                    x: 10,
                    y: height - 20,
                    fontSize: Math.floor(height * 0.05),
                    align: "left"
                },
                markerText && {
                    text: markerText,
                    x: width * 0.5,
                    y: height * 0.15,
                    fontSize: Math.floor(height * 0.06),
                    align: "center"
                }
            ].filter(Boolean)
        });

        yield new VideoFrame(canvas, {
            timestamp: frameIndex * frameDurationUs
        });
    }
}

function invertColor([r, g, b]) {
    return [255 - r, 255 - g, 255 - b];
}

function pad2(value) {
    return String(value).padStart(2, "0");
}

function pad3(value) {
    return String(value).padStart(3, "0");
}

/**
 * createCanvasVideoFrame
 * ---------------------
 * Small rendering helper for deterministic test frames.
 *
 * This function:
 * - performs NO timing logic
 * - performs NO accumulation
 * - draws exactly what it is told
 *
 * Timestamp is always assigned by the caller.
 */
function createCanvasVideoFrame({
    width,
    height,
    backgroundColor,
    rectangles = [],
    texts = []
}) {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // -------------------------------------------------
    // Background
    // -------------------------------------------------
    if (backgroundColor) {
        const [r, g, b] = backgroundColor;
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    } else {
        ctx.fillStyle = "black";
    }

    ctx.fillRect(0, 0, width, height);

    // -------------------------------------------------
    // Rectangles
    // -------------------------------------------------
    for (const rect of rectangles) {
        const [r, g, b] = rect.color;
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    }

    // -------------------------------------------------
    // Text
    // -------------------------------------------------
    ctx.fillStyle = "white";
    ctx.textBaseline = "alphabetic";

    for (const text of texts) {
        ctx.font = `${text.fontSize}px sans-serif`;

        if (text.align === "center") {
            ctx.textAlign = "center";
            ctx.fillText(text.text, text.x, text.y);
        } else if (text.align === "right") {
            ctx.textAlign = "right";
            ctx.fillText(text.text, text.x, text.y);
        } else {
            ctx.textAlign = "left";
            ctx.fillText(text.text, text.x, text.y);
        }
    }

    return canvas;
}
