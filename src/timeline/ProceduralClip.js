/**
 * ProceduralClip
 *
 * Timeline-authored, time-bounded procedural intent.
 *
 * Examples:
 * - Text overlays
 * - Images / logos
 * - Generated graphics
 * - Procedural audio (tones, noise)
 *
 * A ProceduralClip:
 * - Has a start and end time
 * - Emits NO access units
 * - Emits declarative procedural items during planning
 *
 * Rendering, layout, animation, and execution are NOT handled here.
 */
export class ProceduralClip {
    constructor({ kind, startSeconds, endSeconds, items }) {

        if (!Array.isArray(items) || items.length === 0) {
            throw new Error(
                "ProceduralClip: items must be a non-empty array"
            );
        }

        this.kind = kind;
        this.startSeconds = startSeconds;
        this.endSeconds = endSeconds;
        this.items = items;
    }

    /**
     * iterateProceduralItems
     *
     * Contract:
     * - Yields one item per entry in this.items
     * - Attaches clip-bounded time range
     * - Attaches kind so planning can group correctly
     */
    *iterateProceduralItems() {
        for (const item of this.items) {
            yield {
                ...item,
                kind: this.kind,
                startSeconds: this.startSeconds,
                endSeconds: this.endSeconds
            };
        }
    }
}
