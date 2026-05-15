/**
 * Normalize word timestamp records from server or browser Whisper paths.
 *
 * Transformers.js word timestamps arrive as chunks shaped like:
 * `{ text: " word", timestamp: [start, end] }`.
 * Server Whisper JSON usually uses:
 * `{ word: "word", start, end }`.
 *
 * The caption system should not care which infrastructure path produced the
 * timestamps, so this module reduces both forms to `{ text, start, end }`.
 */
export function normalizeWhisperWordTimestamps(wordsOrChunks) {
    if (!Array.isArray(wordsOrChunks)) {
        return [];
    }

    return wordsOrChunks
        .map(normalizeWhisperWordTimestamp)
        .filter(Boolean);
}

function normalizeWhisperWordTimestamp(wordOrChunk) {
    const text = readWordLikeText(wordOrChunk);
    const timing = readWordLikeTiming(wordOrChunk);

    if (!text || !timing) {
        return null;
    }

    return {
        text,
        start: timing.start,
        end: timing.end
    };
}

function readWordLikeText(wordOrChunk) {
    const value = typeof wordOrChunk?.word === "string"
        ? wordOrChunk.word
        : wordOrChunk?.text;

    return typeof value === "string" ? value.trim() : "";
}

function readWordLikeTiming(wordOrChunk) {
    if (Array.isArray(wordOrChunk?.timestamp)) {
        return readTimestampArrayTiming(wordOrChunk.timestamp);
    }

    const start = wordOrChunk?.start;
    const end = wordOrChunk?.end;

    if (!isFiniteNumber(start) || !isFiniteNumber(end) || end < start) {
        return null;
    }

    return { start, end };
}

function readTimestampArrayTiming(timestamp) {
    const [start, end] = timestamp;

    if (!isFiniteNumber(start) || !isFiniteNumber(end) || end < start) {
        return null;
    }

    return { start, end };
}

function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}
