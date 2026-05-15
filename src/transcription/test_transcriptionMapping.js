import { buildTranscriptTextFromWhisperJson } from "./buildTranscriptTextFromWhisperJson.js";
import { normalizeWhisperWordTimestamps } from "./normalizeWhisperWordTimestamps.js";
import { normalizeWhisperTranscriptionResult } from "./normalizeWhisperTranscriptionResult.js";

function assert(condition, message) {
    if (!condition) {
        throw new Error("ASSERT FAILED: " + message);
    }
}

export function test_buildTranscriptTextFromWhisperJson_usesSegmentText() {
    const text = buildTranscriptTextFromWhisperJson({
        segments: [
            { text: "  First line.  " },
            { text: "Second line." }
        ]
    });

    assert(text === "First line.\nSecond line.", "segment text must be trimmed and joined by line");
}

export function test_buildTranscriptTextFromWhisperJson_fallsBackToWords() {
    const text = buildTranscriptTextFromWhisperJson({
        segments: [
            {
                text: "   ",
                words: [
                    { word: " hello " },
                    { word: " world" }
                ]
            }
        ]
    });

    assert(text === "hello world", "word text must be used when segment text is empty");
}

export function test_normalizeWhisperWordTimestamps_acceptsBrowserChunks() {
    const words = normalizeWhisperWordTimestamps([
        { text: " hello", timestamp: [1.25, 1.75] },
        { text: "world ", timestamp: [1.75, 2.25] }
    ]);

    assert(words.length === 2, "browser chunks must normalize to two words");
    assert(words[0].text === "hello", "browser chunk text must be trimmed");
    assert(words[0].start === 1.25, "browser chunk start must be preserved");
    assert(words[1].end === 2.25, "browser chunk end must be preserved");
}

export function test_normalizeWhisperWordTimestamps_acceptsServerWords() {
    const words = normalizeWhisperWordTimestamps([
        { word: "hello", start: 0.5, end: 0.75 },
        { word: "bad", start: 2, end: 1 },
        { word: "world", start: 0.75, end: 1.25 }
    ]);

    assert(words.length === 2, "invalid server word timing must be dropped");
    assert(words[1].text === "world", "server word text must be normalized to text field");
}

export function test_normalizeWhisperTranscriptionResult_buildsWhisperJsonFromBrowserWords() {
    const result = normalizeWhisperTranscriptionResult({
        browserResult: {
            text: "hello world",
            chunks: [
                { text: " hello", timestamp: [1, 1.4] },
                { text: " world", timestamp: [1.4, 2] }
            ]
        }
    });

    assert(result.text === "hello world", "normalized browser result must expose transcript text");
    assert(result.words.length === 2, "normalized browser result must expose words");
    assert(result.whisperJson.segments.length === 1, "browser result must become one Whisper segment");
    assert(result.whisperJson.segments[0].words[0].word === "hello", "Whisper JSON words must use word field");
}

export const TRANSCRIPTION_MAPPING_TESTS = [
    test_buildTranscriptTextFromWhisperJson_usesSegmentText,
    test_buildTranscriptTextFromWhisperJson_fallsBackToWords,
    test_normalizeWhisperWordTimestamps_acceptsBrowserChunks,
    test_normalizeWhisperWordTimestamps_acceptsServerWords,
    test_normalizeWhisperTranscriptionResult_buildsWhisperJsonFromBrowserWords
];
