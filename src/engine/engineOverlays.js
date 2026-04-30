const DEFAULT_TEXT_OVERLAY_STYLE = Object.freeze({
    // Mirrors Drupal caption style: bevan_s_bench_portrait
    fontFamily: "'FrameSmithAntonSC', 'Anton SC', 'Anton', 'Arial Black', sans-serif",
    fontWeight: 700,
    fontSizePx: 40,
    lineHeightPx: 50,
    // Drupal ASS style uses MarginL/MarginR=200 on 1920 and MarginV=175 on 1080.
    // For 720x1280 export this maps closely to:
    sidePaddingPx: 75,
    bottomPaddingPx: 208,
    textAlign: "center",
    // ASS colors use AABBGGRR; values below are converted to CSS RGB.
    // primaryColour: &H0065bdd7 -> #d7bd65
    // primaryHighlight.primaryColour: &H00e1c46b -> #6bc4e1
    // secondaryHighlight.primaryColour: &H007a5d66 -> #665d7a
    baseFill: "#D7BD65",
    baseStroke: "#000000",
    strokeWidthPx: 2,
    activeFill: "#6BC4E1",
    secondaryActiveFill: "#665D7A",
    secondaryHighlightEvery: 5,
    // Old Drupal ASS chunking defaults (AssSubtitleGenerator)
    maxWordsPerChunk: 6,
    maxChunkDurationSeconds: 2.0,
    pauseSplitThresholdSeconds: 0.3,
    shadowColor: "rgba(0, 0, 0, 0)",
    shadowBlurPx: 0
});

const DEFAULT_IMAGE_OVERLAY_STYLE = Object.freeze({
    anchor: "top-left",
    marginXPct: 3,
    marginYPct: 3,
    opacity: 1
});

const DEFAULT_IMAGE_OVERLAY_PULSE = Object.freeze({
    largeScalePct: 30,
    smallScalePct: 24,
    cycleSeconds: 6.5
});

let runtimeTranscriptOverlayItems = null;

function loadImageDrawableFromPath(path) {
    return fetch(path)
        .then((response) => {
            if (!response.ok) return null;
            return response.blob();
        })
        .then((blob) => {
            if (!blob) return null;
            if (typeof createImageBitmap === "function") {
                return createImageBitmap(blob);
            }
            if (typeof Image === "function") {
                const objectUrl = URL.createObjectURL(blob);
                const image = new Image();
                const loaded = new Promise((resolve, reject) => {
                    image.onload = () => resolve(image);
                    image.onerror = (error) => reject(error);
                });
                image.src = objectUrl;
                return loaded.finally(() => URL.revokeObjectURL(objectUrl));
            }
            return null;
        })
        .catch((error) => {
            console.warn("[Timeline][image-overlay] failed to load image drawable", {
                path,
                error: error?.message ?? String(error)
            });
            return null;
        });
}

function tokenizeTranscriptText(text) {
    if (typeof text !== "string") return [];
    const matches = text.match(/\S+/g);
    return Array.isArray(matches) ? matches : [];
}

function buildTimedWordsFromSegment(segment) {
    if (!segment || typeof segment.start !== "number" || typeof segment.end !== "number") {
        return [];
    }
    if (Array.isArray(segment.words) && segment.words.length > 0) {
        return segment.words
            .map((word) => {
                const text = typeof word?.word === "string" ? word.word.trim() : "";
                const start = typeof word?.start === "number" ? word.start : null;
                const end = typeof word?.end === "number" ? word.end : null;
                if (!text || typeof start !== "number" || typeof end !== "number") return null;
                return { text, start, end };
            })
            .filter(Boolean);
    }
    const tokens = tokenizeTranscriptText(segment.text);
    if (tokens.length === 0) return [];

    const startSeconds = segment.start;
    const endSeconds = Math.max(segment.end, startSeconds + 0.001);
    const totalDuration = endSeconds - startSeconds;
    const totalWeight = tokens.reduce((sum, token) => sum + Math.max(token.length, 1), 0);

    let cursor = startSeconds;
    return tokens.map((token, index) => {
        const weight = Math.max(token.length, 1);
        const idealDuration = totalDuration * (weight / totalWeight);
        const start = cursor;
        const isLastToken = index === tokens.length - 1;
        const end = isLastToken ? endSeconds : Math.min(endSeconds, cursor + idealDuration);
        cursor = end;
        return {
            text: token,
            start,
            end
        };
    });
}

export function buildTextOverlayItemsFromWhisperJson(whisperJson) {
    if (!whisperJson || !Array.isArray(whisperJson.segments)) return [];

    const styleDefaults = { ...DEFAULT_TEXT_OVERLAY_STYLE };
    const maxWordsPerChunk = Math.max(1, Math.floor(styleDefaults.maxWordsPerChunk ?? 6));
    const maxChunkDurationSeconds = Math.max(0.1, Number(styleDefaults.maxChunkDurationSeconds ?? 2.0));
    const pauseSplitThresholdSeconds = Math.max(0, Number(styleDefaults.pauseSplitThresholdSeconds ?? 0.3));

    let nextOverlayIndex = 0;

    return whisperJson.segments
        .flatMap((segment) => {
            const words = buildTimedWordsFromSegment(segment);
            if (words.length === 0) return [];

            const segmentItems = [];
            let chunkWords = [];
            let chunkStartSeconds = words[0].start;

            const pushChunk = () => {
                if (chunkWords.length === 0) return;
                const firstWord = chunkWords[0];
                const lastWord = chunkWords[chunkWords.length - 1];
                segmentItems.push({
                    id: `whisper-segment-${nextOverlayIndex++}`,
                    startSeconds: firstWord.start,
                    endSeconds: lastWord.end,
                    words: chunkWords.map((word) => ({ ...word })),
                    style: {
                        ...styleDefaults
                    },
                    override: [],
                    animate: []
                });
            };

            for (let index = 0; index < words.length; index += 1) {
                const word = words[index];
                const nextWord = words[index + 1];

                if (chunkWords.length === 0) {
                    chunkStartSeconds = word.start;
                }
                chunkWords.push(word);

                const chunkDurationSeconds = word.end - chunkStartSeconds;
                const pauseSeconds = nextWord ? (nextWord.start - word.end) : 0;
                const reachedMaxWords = chunkWords.length >= maxWordsPerChunk;
                const reachedMaxDuration = chunkDurationSeconds >= maxChunkDurationSeconds;
                const reachedPauseSplit = !!nextWord && pauseSeconds >= pauseSplitThresholdSeconds;
                const reachedEndOfSegment = !nextWord;

                if (reachedMaxWords || reachedMaxDuration || reachedPauseSplit || reachedEndOfSegment) {
                    pushChunk();
                    chunkWords = [];
                }
            }

            return segmentItems;
        })
        .filter(Boolean);
}

export async function loadTimelineImageOverlays() {
    const logoPath = "./logo.png";
    const drawable = await loadImageDrawableFromPath(logoPath);
    if (!drawable) {
        console.warn("[Timeline][image-overlay] logo drawable unavailable; skipping logo overlay", {
            logoPath
        });
        return [];
    }

    const overlayItem = {
        id: "logo-overlay-default",
        startSeconds: 0,
        drawable,
        style: {
            ...DEFAULT_IMAGE_OVERLAY_STYLE
        },
        pulse: {
            ...DEFAULT_IMAGE_OVERLAY_PULSE
        }
    };

    console.log("[Timeline][image-overlay] loaded logo overlay item", {
        logoPath
    });
    return [overlayItem];
}

export function setRuntimeTranscriptOverlayItems(items) {
    runtimeTranscriptOverlayItems = Array.isArray(items) ? items : null;
    return runtimeTranscriptOverlayItems;
}

export function clearRuntimeTranscriptOverlayItems() {
    runtimeTranscriptOverlayItems = null;
}

export async function loadTimelineTextOverlays() {
    if (Array.isArray(runtimeTranscriptOverlayItems) && runtimeTranscriptOverlayItems.length > 0) {
        console.log("[Timeline][text-overlay] using runtime transcript overlay items", {
            itemCount: runtimeTranscriptOverlayItems.length
        });
        return runtimeTranscriptOverlayItems;
    }

    const transcriptCandidates = [
        "./90502899-3eba-43a0-a8ed-3834d685e7b4.json"
    ];

    for (const transcriptPath of transcriptCandidates) {
        try {
            const response = await fetch(transcriptPath);
            if (!response.ok) continue;
            const json = await response.json();
            const overlayItems = buildTextOverlayItemsFromWhisperJson(json);
            if (overlayItems.length === 0) continue;
            console.log("[Timeline][text-overlay] loaded transcript overlay items", {
                transcriptPath,
                itemCount: overlayItems.length
            });
            return overlayItems;
        } catch (error) {
            console.warn("[Timeline][text-overlay] failed to load transcript candidate", {
                transcriptPath,
                error: error?.message ?? String(error)
            });
        }
    }

    console.warn("[Timeline][text-overlay] no transcript overlay loaded; falling back to default demo overlay");
    return [];
}

export { DEFAULT_TEXT_OVERLAY_STYLE, DEFAULT_IMAGE_OVERLAY_STYLE, DEFAULT_IMAGE_OVERLAY_PULSE };
