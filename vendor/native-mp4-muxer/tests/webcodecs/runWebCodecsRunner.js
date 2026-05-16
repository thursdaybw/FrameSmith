
/**
 * Runs WebCodecs and returns raw encoder output.
 * Knows NOTHING about MP4 or container structure.
 */
export async function runWebCodecsRunner({
    codec,
    width,
    height,
    bitrate,
    framerate,
    frames,
    mediaRecorderSink // OPTIONAL
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

    let frameDurationMs;
    let lastFrameWallClockMs;

    if (mediaRecorderSink) {
        frameDurationMs = 1000 / framerate;
        lastFrameWallClockMs = performance.now();
    }

    for (const frame of frames) {

        if (mediaRecorderSink) {
            const nowMs = performance.now();
            const elapsedMs = nowMs - lastFrameWallClockMs;

            if (elapsedMs < frameDurationMs) {
                await new Promise(r =>
                    setTimeout(r, frameDurationMs - elapsedMs)
                );
            }

            lastFrameWallClockMs = performance.now();
        }

        // --- backpressure ---
        while (encoder.encodeQueueSize > 30) {
            await new Promise(r => setTimeout(r, 0));
        }

        // -------------------------------------------------
        // OPTIONAL parallel sink (e.g. MediaRecorder)
        // -------------------------------------------------
        if (mediaRecorderSink) {
            mediaRecorderSink.draw(frame);
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
