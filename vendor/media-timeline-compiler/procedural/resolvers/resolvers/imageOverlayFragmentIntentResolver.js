/**
 * resolveImageOverlayFragmentIntentAtTime
 *
 * PROCEDURAL INTENT RESOLUTION — IMAGE OVERLAY
 *
 * Responsibility:
 * - Evaluate image-overlay procedural fragments at a specific time.
 * - Emit render intent items with resolved animation state for that time.
 *
 * This function does NOT:
 * - Decode images
 * - Allocate VideoFrame or AudioData
 * - Draw to canvas
 */
export function resolveImageOverlayFragmentIntentAtTime({ fragment, timeSeconds }) {
    if (!fragment || !Array.isArray(fragment.items)) {
        throw new Error("resolveImageOverlayFragmentIntentAtTime: fragment.items required");
    }

    if (typeof timeSeconds !== "number") {
        throw new Error("resolveImageOverlayFragmentIntentAtTime: timeSeconds must be number");
    }

    const activeItems = [];

    for (const item of fragment.items) {
        const startSeconds = typeof item?.startSeconds === "number" ? item.startSeconds : -Infinity;
        const endSeconds = typeof item?.endSeconds === "number" ? item.endSeconds : Infinity;

        if (timeSeconds < startSeconds) continue;
        if (timeSeconds > endSeconds) continue;

        const pulse = item?.pulse ?? {};
        const cycleSeconds = typeof pulse.cycleSeconds === "number" && pulse.cycleSeconds > 0
            ? pulse.cycleSeconds
            : 5;
        const largeScalePct = typeof pulse.largeScalePct === "number" ? pulse.largeScalePct : 35;
        const smallScalePct = typeof pulse.smallScalePct === "number" ? pulse.smallScalePct : 25;

        const elapsedSeconds = Math.max(0, timeSeconds - startSeconds);
        const midpointScalePct = (largeScalePct + smallScalePct) / 2;
        const amplitudeScalePct = Math.abs(largeScalePct - smallScalePct) / 2;
        const phaseRadians = (elapsedSeconds / cycleSeconds) * (Math.PI * 2);
        const scalePct = midpointScalePct + (Math.cos(phaseRadians) * amplitudeScalePct);

        activeItems.push({
            ...item,
            animatedScalePct: scalePct
        });
    }

    if (activeItems.length === 0) {
        return { renderIntents: [] };
    }

    return {
        renderIntents: [
            {
                kind: "image-overlay",
                fragment,
                timeSeconds,
                items: activeItems
            }
        ]
    };
}
