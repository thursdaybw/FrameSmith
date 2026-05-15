import { buildTranscriptTextFromWhisperJson } from "./buildTranscriptTextFromWhisperJson.js";
import { normalizeWhisperWordTimestamps } from "./normalizeWhisperWordTimestamps.js";

/**
 * Normalize transcription output into one FrameSmith-facing shape.
 *
 * This function is deliberately infrastructure-blind. It accepts either existing
 * Whisper JSON from the server path or a Transformers.js browser ASR result and
 * returns a Whisper-shaped result suitable for transcript/caption mapping.
 */
export function normalizeWhisperTranscriptionResult(input) {
    if (input?.whisperJson) {
        return normalizeExistingWhisperJsonResult(input.whisperJson);
    }

    if (input?.browserResult) {
        return normalizeBrowserWhisperResult(input.browserResult);
    }

    return createEmptyTranscriptionResult();
}

function normalizeExistingWhisperJsonResult(whisperJson) {
    return {
        text: buildTranscriptTextFromWhisperJson(whisperJson),
        whisperJson,
        words: collectWordsFromWhisperJson(whisperJson)
    };
}

function normalizeBrowserWhisperResult(browserResult) {
    const words = normalizeWhisperWordTimestamps(browserResult?.chunks);
    const fallbackText = typeof browserResult?.text === "string" ? browserResult.text.trim() : "";
    const whisperJson = buildWhisperJsonFromWords({
        text: fallbackText,
        words
    });

    return {
        text: buildTranscriptTextFromWhisperJson(whisperJson) || fallbackText,
        whisperJson,
        words
    };
}

function collectWordsFromWhisperJson(whisperJson) {
    if (!Array.isArray(whisperJson?.segments)) {
        return [];
    }

    return whisperJson.segments.flatMap((segment) => normalizeWhisperWordTimestamps(segment?.words));
}

function buildWhisperJsonFromWords({ text, words }) {
    if (!Array.isArray(words) || words.length === 0) {
        return {
            text,
            segments: text ? [{ text, start: 0, end: 0, words: [] }] : []
        };
    }

    return {
        text: text || words.map((word) => word.text).join(" "),
        segments: [
            {
                text: text || words.map((word) => word.text).join(" "),
                start: words[0].start,
                end: words[words.length - 1].end,
                words: words.map((word) => ({
                    word: word.text,
                    start: word.start,
                    end: word.end
                }))
            }
        ]
    };
}

function createEmptyTranscriptionResult() {
    return {
        text: "",
        whisperJson: { text: "", segments: [] },
        words: []
    };
}
