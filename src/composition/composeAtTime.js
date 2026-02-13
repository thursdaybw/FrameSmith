function toSafeZIndex(layer) {
    const zIndex = layer?.zIndex;
    if (typeof zIndex !== "number" || Number.isNaN(zIndex)) return 0;
    return zIndex;
}

function orderActiveLayersByZIndex(activeLayers) {
    return [...activeLayers].sort((a, b) => toSafeZIndex(a) - toSafeZIndex(b));
}

function createCompositionError({ code, message, cause }) {
    const error = new Error(message);
    error.code = code;
    if (cause !== undefined) {
        error.cause = cause;
    }
    return error;
}

function secondsToMicroseconds(timeSeconds) {
    return Math.round(timeSeconds * 1_000_000);
}

function toCssColor(background = {}) {
    const r = Math.round((background.r ?? 0) * 255);
    const g = Math.round((background.g ?? 0) * 255);
    const b = Math.round((background.b ?? 0) * 255);
    const a = background.a ?? 1;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
}

const DEFAULT_TEXT_STYLE = Object.freeze({
    fontFamily: "'Anton SC', 'Anton', 'Arial Black', sans-serif",
    fontWeight: 700,
    fontSizePx: 70,
    lineHeightPx: 86,
    sidePaddingPx: 75,
    bottomPaddingPx: 208,
    textAlign: "center",
    baseFill: "#D7BD65",
    baseStroke: "#000000",
    strokeWidthPx: 2,
    activeFill: "#6BC4E1",
    secondaryActiveFill: "#665D7A",
    secondaryHighlightEvery: 5,
    shadowColor: "rgba(0, 0, 0, 0)",
    shadowBlurPx: 0
});

function normalizeTextStyle(style = {}) {
    return {
        ...DEFAULT_TEXT_STYLE,
        ...(style || {})
    };
}

function isWordActiveAtTime(word, timeSeconds) {
    const start = typeof word?.start === "number" ? word.start : -Infinity;
    const end = typeof word?.end === "number" ? word.end : Infinity;
    return timeSeconds >= start && timeSeconds < end;
}

function getWordsForRendering(item = {}, timeSeconds) {
    const allWords = Array.isArray(item.allWords) && item.allWords.length > 0
        ? item.allWords
        : (Array.isArray(item.words) ? item.words : []);

    if (allWords.length === 0) return { words: [], activeWordIndex: -1 };

    const activeWordIndex = Number.isInteger(item.activeWordIndex) && item.activeWordIndex >= 0
        ? item.activeWordIndex
        : allWords.findIndex((word) => isWordActiveAtTime(word, timeSeconds));

    return { words: allWords, activeWordIndex };
}

function wrapWordsToLines(ctx, words, maxLineWidth) {
    const lines = [];
    let currentLine = [];
    let currentLineWidth = 0;

    for (let index = 0; index < words.length; index += 1) {
        const word = words[index];
        const text = typeof word?.text === "string" ? word.text.trim() : "";
        if (!text) continue;

        const wordWidth = ctx.measureText(text).width;
        const spacerWidth = currentLine.length === 0 ? 0 : ctx.measureText(" ").width;
        const projectedWidth = currentLineWidth + spacerWidth + wordWidth;

        if (currentLine.length > 0 && projectedWidth > maxLineWidth) {
            lines.push({ words: currentLine, width: currentLineWidth });
            currentLine = [{ index, text, width: wordWidth }];
            currentLineWidth = wordWidth;
            continue;
        }

        currentLine.push({ index, text, width: wordWidth });
        currentLineWidth = projectedWidth;
    }

    if (currentLine.length > 0) {
        lines.push({ words: currentLine, width: currentLineWidth });
    }

    return lines;
}

function getLineStartX(style, canvasWidth, lineWidth) {
    if (style.textAlign === "left") {
        return style.sidePaddingPx;
    }
    if (style.textAlign === "right") {
        return Math.max(style.sidePaddingPx, canvasWidth - style.sidePaddingPx - lineWidth);
    }
    return Math.max(style.sidePaddingPx, Math.round((canvasWidth - lineWidth) / 2));
}

function drawStyledTextOverlayItem({ ctx, canvas, item, timeSeconds, yOffsetPx }) {
    const { words, activeWordIndex } = getWordsForRendering(item, timeSeconds);
    if (words.length === 0) return yOffsetPx;

    const style = normalizeTextStyle(item?.style);
    const fontSizePx = Math.max(12, Math.round(style.fontSizePx));
    const lineHeightPx = Math.max(fontSizePx + 4, Math.round(style.lineHeightPx));
    const sidePaddingPx = Math.max(8, Math.round(style.sidePaddingPx));
    const bottomPaddingPx = Math.max(8, Math.round(style.bottomPaddingPx));
    const strokeWidthPx = Math.max(0, Math.round(style.strokeWidthPx));
    const maxLineWidth = Math.max(16, canvas.width - (sidePaddingPx * 2));
    const highlightEvery = Math.max(1, Math.round(style.secondaryHighlightEvery));

    const fontWeight = style.fontWeight ?? 700;
    ctx.font = `${fontWeight} ${fontSizePx}px ${style.fontFamily}`;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;

    const lines = wrapWordsToLines(ctx, words, maxLineWidth);
    if (lines.length === 0) return yOffsetPx;

    const blockHeight = lines.length * lineHeightPx;
    const blockBottomY = canvas.height - bottomPaddingPx - yOffsetPx;
    const blockTopY = Math.max(0, blockBottomY - blockHeight);

    ctx.shadowColor = style.shadowColor;
    ctx.shadowBlur = Math.max(0, Math.round(style.shadowBlurPx));
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const line = lines[lineIndex];
        const baselineY = blockTopY + ((lineIndex + 1) * lineHeightPx) - Math.round((lineHeightPx - fontSizePx) / 2);
        let cursorX = getLineStartX(style, canvas.width, line.width);

        for (let wordIndex = 0; wordIndex < line.words.length; wordIndex += 1) {
            const word = line.words[wordIndex];
            const isActive = word.index === activeWordIndex;
            const isSecondaryActive = isActive && ((word.index + 1) % highlightEvery === 0);
            const fillColor = isSecondaryActive ? style.secondaryActiveFill : (isActive ? style.activeFill : style.baseFill);

            if (strokeWidthPx > 0) {
                ctx.lineWidth = strokeWidthPx;
                ctx.strokeStyle = style.baseStroke;
                ctx.strokeText(word.text, cursorX, baselineY);
            }

            ctx.fillStyle = fillColor;
            ctx.fillText(word.text, cursorX, baselineY);
            cursorX += word.width + ctx.measureText(" ").width;
        }
    }

    return yOffsetPx + blockHeight + 16;
}

function createCompositionCanvas({ width, height, background }) {
    const canvasWidth = Math.max(1, Math.round(width));
    const canvasHeight = Math.max(1, Math.round(height));

    if (typeof OffscreenCanvas === "function") {
        const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        ctx.fillStyle = toCssColor(background);
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        return canvas;
    }

    if (typeof document !== "undefined" && typeof document.createElement === "function") {
        const canvas = document.createElement("canvas");
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        ctx.fillStyle = toCssColor(background);
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        return canvas;
    }

    return null;
}

function drawRenderIntentsOnCanvas({ canvas, renderIntents = [], timeSeconds }) {
    if (!Array.isArray(renderIntents) || renderIntents.length === 0) return;
    if (!canvas || typeof canvas.getContext !== "function") return;

    const ctx = canvas.getContext("2d");
    if (!ctx || typeof ctx.fillText !== "function") return;

    let yOffsetPx = 0;
    for (const intent of renderIntents) {
        if (!intent || intent.kind !== "text-overlay") continue;

        const items = Array.isArray(intent.items) ? intent.items : [];
        for (const item of items) {
            yOffsetPx = drawStyledTextOverlayItem({
                ctx,
                canvas,
                item,
                timeSeconds,
                yOffsetPx
            });
        }
    }
}

function pickClosestTimestampedItem(items, targetTimestampUs) {
    let closest = null;
    let closestDelta = Infinity;

    for (const item of items) {
        if (!item || typeof item.timestamp !== "number") continue;
        const delta = Math.abs(item.timestamp - targetTimestampUs);
        if (delta < closestDelta) {
            closest = item;
            closestDelta = delta;
        }
    }

    return closest;
}

function pickTimestampedItemAtOrAfter(items, targetTimestampUs) {
    let fallback = null;
    let fallbackDelta = Infinity;

    for (const item of items) {
        if (!item || typeof item.timestamp !== "number") continue;

        if (item.timestamp >= targetTimestampUs) {
            return item;
        }

        const delta = targetTimestampUs - item.timestamp;
        if (delta < fallbackDelta) {
            fallback = item;
            fallbackDelta = delta;
        }
    }

    return fallback;
}

function isDrawableFrameCandidate(item) {
    if (!item || typeof item !== "object") return false;
    if (typeof item.timestamp !== "number") return false;
    if (typeof VideoFrame === "function" && item instanceof VideoFrame) return true;
    const drawable = item.drawable;
    return !!drawable;
}

function createVideoFrameArtifact({ timeSeconds, options, decodedContainerBackedFragmentBatch, renderIntents }) {
    if (typeof VideoFrame !== "function") {
        return { value: null, issue: null };
    }

    const existingFrames = decodedContainerBackedFragmentBatch?.decodedVideoFrames;
    if (Array.isArray(existingFrames)) {
        const targetTimestampUs = secondsToMicroseconds(timeSeconds);
        const drawableFrames = existingFrames
            .filter(isDrawableFrameCandidate)
            .sort((a, b) => a.timestamp - b.timestamp);
        const sourceFrameRecord = pickTimestampedItemAtOrAfter(
            drawableFrames,
            targetTimestampUs
        );
        if (sourceFrameRecord) {
            const sourceDrawable = sourceFrameRecord.drawable ?? sourceFrameRecord;
            const width = options?.outputSpec?.width ?? sourceDrawable.displayWidth ?? sourceDrawable.codedWidth ?? sourceDrawable.width ?? 2;
            const height = options?.outputSpec?.height ?? sourceDrawable.displayHeight ?? sourceDrawable.codedHeight ?? sourceDrawable.height ?? 2;
            const background = options?.background ?? { r: 0, g: 0, b: 0, a: 1 };
            const sourceCanvas = createCompositionCanvas({ width, height, background });

            if (sourceCanvas) {
                const ctx = sourceCanvas.getContext("2d");
                if (ctx && typeof ctx.drawImage === "function") {
                    try {
                        ctx.drawImage(sourceDrawable, 0, 0, sourceCanvas.width, sourceCanvas.height);
                        drawRenderIntentsOnCanvas({
                            canvas: sourceCanvas,
                            renderIntents,
                            timeSeconds
                        });
                        return {
                            value: new VideoFrame(sourceCanvas, {
                                timestamp: targetTimestampUs
                            }),
                            issue: null
                        };
                    } catch {
                        // Fall through to clone path.
                    }
                }
            }

            try {
                return {
                    value: new VideoFrame(sourceDrawable, {
                    timestamp: targetTimestampUs
                    }),
                    issue: null
                };
            } catch (cause) {
                return {
                    value: null,
                    issue: createCompositionError({
                        code: "COMPOSITION_VIDEOFRAME_CLONE_FAILED",
                        message: "composeAtTime: failed to clone decoded VideoFrame artifact",
                        cause
                    })
                };
            }
        }
    }

    const width = options?.outputSpec?.width ?? 2;
    const height = options?.outputSpec?.height ?? 2;
    const background = options?.background ?? { r: 0, g: 0, b: 0, a: 1 };
    const source = createCompositionCanvas({ width, height, background });
    if (!source) {
        return {
            value: null,
            issue: createCompositionError({
                code: "COMPOSITION_CANVAS_UNAVAILABLE",
                message: "composeAtTime: no canvas backend available for VideoFrame composition"
            })
        };
    }

    drawRenderIntentsOnCanvas({
        canvas: source,
        renderIntents,
        timeSeconds
    });

    try {
        return {
            value: new VideoFrame(source, {
                timestamp: secondsToMicroseconds(timeSeconds)
            }),
            issue: null
        };
    } catch (cause) {
        return {
            value: null,
            issue: createCompositionError({
                code: "COMPOSITION_VIDEOFRAME_ALLOCATE_FAILED",
                message: "composeAtTime: failed to allocate composed VideoFrame artifact",
                cause
            })
        };
    }
}

function createAudioDataArtifact({ timeSeconds, options, decodedContainerBackedFragmentBatch }) {
    if (typeof AudioData !== "function") {
        return { value: null, issue: null };
    }

    const existingAudio = decodedContainerBackedFragmentBatch?.decodedAudioData;
    if (Array.isArray(existingAudio)) {
        const sourceAudioData = pickClosestTimestampedItem(
            existingAudio.filter(audio => audio instanceof AudioData),
            secondsToMicroseconds(timeSeconds)
        );
        if (sourceAudioData) {
            return { value: sourceAudioData, issue: null };
        }
    }

    const sampleRate = options?.outputSpec?.sampleRate ?? 48_000;
    const numberOfChannels = options?.outputSpec?.channels ?? 2;
    const fps = options?.outputSpec?.fps ?? 30;
    const frameDurationSeconds = options?.frameDurationSeconds ?? (1 / fps);
    const numberOfFrames = Math.max(1, Math.round(sampleRate * frameDurationSeconds));
    const planarSamples = new Float32Array(numberOfFrames * numberOfChannels);

    try {
        return {
            value: new AudioData({
                format: "f32-planar",
                sampleRate,
                numberOfFrames,
                numberOfChannels,
                timestamp: secondsToMicroseconds(timeSeconds),
                data: planarSamples
            }),
            issue: null
        };
    } catch (cause) {
        return {
            value: null,
            issue: createCompositionError({
                code: "COMPOSITION_AUDIODATA_ALLOCATE_FAILED",
                message: "composeAtTime: failed to allocate composed AudioData artifact",
                cause
            })
        };
    }
}

/**
 * composeAtTime
 *
 * Production composition seam.
 * Memory policy reference:
 * - docs/framesmith-architecture.md
 * - "Memory Ownership and Future Optimization Seams"
 *
 * Current behavior (intentionally simple):
 * - Orders active layers by zIndex.
 * - Returns a deterministic composed shape for one time slice.
 *
 * Future implementations will replace placeholders with real VideoFrame/AudioData
 * composition while keeping this boundary contract stable.
 */
export function composeAtTime({
    timeSeconds,
    decodedContainerBackedFragmentBatch,
    activeLayers = [],
    renderIntents = [],
    options = {}
}) {
    const describeValue = (value) => {
        const typeTag = Object.prototype.toString.call(value);
        if (typeof value === "string") return `${typeTag}(${JSON.stringify(value)})`;
        if (typeof value === "number" || typeof value === "boolean" || value === null || value === undefined) {
            return `${typeTag}(${String(value)})`;
        }
        return typeTag;
    };

    if (typeof timeSeconds !== "number" || Number.isNaN(timeSeconds)) {
        throw new Error(
            "composeAtTime: timeSeconds must be a valid number. " +
            `Received ${describeValue(timeSeconds)}`
        );
    }

    if (!decodedContainerBackedFragmentBatch || typeof decodedContainerBackedFragmentBatch !== "object") {
        throw new Error(
            "composeAtTime: decodedContainerBackedFragmentBatch must be an object. " +
            `Received ${describeValue(decodedContainerBackedFragmentBatch)}`
        );
    }

    if (!Array.isArray(activeLayers)) {
        throw new Error(
            "composeAtTime: activeLayers must be an array. " +
            `Received ${describeValue(activeLayers)}`
        );
    }

    if (!Array.isArray(renderIntents)) {
        throw new Error(
            "composeAtTime: renderIntents must be an array. " +
            `Received ${describeValue(renderIntents)}`
        );
    }

    const orderedActiveLayers = orderActiveLayersByZIndex(activeLayers);
    const layerOrder = orderedActiveLayers.map(layer => toSafeZIndex(layer));
    const audioStrategy = options.audioStrategy ?? "mixToSingleTrack";
    const strictComposition = options.strictComposition === true;

    const videoArtifactResult = createVideoFrameArtifact({
        timeSeconds,
        options,
        decodedContainerBackedFragmentBatch,
        renderIntents
    });

    const audioArtifactResult = createAudioDataArtifact({
        timeSeconds,
        options,
        decodedContainerBackedFragmentBatch
    });

    const diagnostics = {
        issues: []
    };

    if (videoArtifactResult.issue) {
        diagnostics.issues.push(videoArtifactResult.issue);
    }
    if (audioArtifactResult.issue) {
        diagnostics.issues.push(audioArtifactResult.issue);
    }

    if (strictComposition && diagnostics.issues.length > 0) {
        const primaryIssue = diagnostics.issues[0];
        throw createCompositionError({
            code: "COMPOSITION_STRICT_FAILURE",
            message: `composeAtTime: strict composition failed due to ${primaryIssue.code}`,
            cause: primaryIssue
        });
    }

    // Deterministic metadata shape is preserved for current callers/tests.
    // Real WebCodecs artifacts are attached when available.
    const composedVideoFrame = {
        timestamp: timeSeconds,
        layerOrder,
        videoFrame: videoArtifactResult.value
    };

    const composedAudioData = {
        timestamp: timeSeconds,
        audioStrategy,
        audioData: audioArtifactResult.value
    };

    return {
        composedVideoFrame,
        composedAudioData,
        diagnostics
    };
}
