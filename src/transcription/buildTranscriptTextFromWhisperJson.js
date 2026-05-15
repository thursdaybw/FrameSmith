/**
 * Build readable transcript text from Whisper-shaped JSON.
 *
 * Server Whisper output normally supplies segment text. Some browser/local paths
 * may supply word timing without useful segment text, so this mapper falls back
 * to joining timed words. Keep this function pure: UI, timeline mutation,
 * network, and model runtime concerns belong outside this boundary.
 */
export function buildTranscriptTextFromWhisperJson(whisperJson) {
    if (!whisperJson || !Array.isArray(whisperJson.segments)) {
        return "";
    }

    const lines = [];

    for (const segment of whisperJson.segments) {
        const segmentText = readNonEmptySegmentText(segment);

        if (segmentText) {
            lines.push(segmentText);
            continue;
        }

        const wordText = buildTranscriptTextFromSegmentWords(segment);
        if (wordText) {
            lines.push(wordText);
        }
    }

    return lines.join("\n");
}

function readNonEmptySegmentText(segment) {
    const text = typeof segment?.text === "string" ? segment.text.trim() : "";
    return text.length > 0 ? text : "";
}

function buildTranscriptTextFromSegmentWords(segment) {
    if (!Array.isArray(segment?.words)) {
        return "";
    }

    return segment.words
        .map((word) => readWordText(word))
        .filter(Boolean)
        .join(" ");
}

function readWordText(word) {
    const text = typeof word?.word === "string"
        ? word.word
        : word?.text;

    return typeof text === "string" ? text.trim() : "";
}
