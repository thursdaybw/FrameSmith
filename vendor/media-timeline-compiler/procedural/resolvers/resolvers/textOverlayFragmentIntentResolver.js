/**
 * resolveTextOverlayFragmentIntentAtTime
 *
 * PROCEDURAL INTENT RESOLUTION — TEXT OVERLAY
 *
 * Responsibility:
 * - Evaluate text-overlay procedural fragment at a specific time
 * - Determine which authored items are active
 * - Emit render-intent objects describing what exists at that time
 *
 * This function does NOT:
 * - Allocate VideoFrame or AudioData
 * - Perform composition
 * - Interpret layout, fonts, pixels, or animation curves
 * - Mutate authored payload
 *
 * Determinism:
 * - Pure function
 * - No internal state
 */
export function resolveTextOverlayFragmentIntentAtTime({ fragment, timeSeconds }) {

    if (!fragment || !Array.isArray(fragment.items)) {
        throw new Error(
            "resolveTextOverlayFragmentIntentAtTime: fragment.items required"
        );
    }

    if (typeof timeSeconds !== "number") {
        throw new Error(
            "resolveTextOverlayFragmentIntentAtTime: timeSeconds must be number"
        );
    }

    const activeItems = [];

    for (const item of fragment.items) {

        if (timeSeconds < item.startSeconds) continue;
        if (timeSeconds > item.endSeconds) continue;

        const sourceWords = Array.isArray(item.words) ? item.words : [];
        const activeWords = sourceWords
            .filter((word) => {
                const start = typeof word.start === "number" ? word.start : -Infinity;
                const end = typeof word.end === "number" ? word.end : Infinity;
                // Use half-open intervals to avoid boundary overlap:
                // [start, end)
                return timeSeconds >= start && timeSeconds < end;
            });

        if (activeWords.length === 0) continue;

        const activeWordIndex = sourceWords.findIndex((word) => {
            const start = typeof word.start === "number" ? word.start : -Infinity;
            const end = typeof word.end === "number" ? word.end : Infinity;
            return timeSeconds >= start && timeSeconds < end;
        });

        activeItems.push({
            ...item,
            words: activeWords,
            allWords: sourceWords,
            activeWordIndex
        });
    }

    if (activeItems.length === 0) {
        return { renderIntents: [] };
    }

    return {
        renderIntents: [
            {
                kind: "text-overlay",
                fragment,
                timeSeconds,
                items: activeItems
            }
        ]
    };
}
