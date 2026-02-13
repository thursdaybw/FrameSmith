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

        const activeWords = Array.isArray(item.words)
            ? item.words.filter(word =>
                timeSeconds >= word.start &&
                timeSeconds <= word.end
            )
            : [];

        if (activeWords.length === 0) continue;

        activeItems.push({
            ...item,
            words: activeWords
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
