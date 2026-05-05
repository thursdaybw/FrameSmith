/**
 * resolveProceduralSelection
 *
 * Procedural resolution stage.
 *
 * Responsibility:
 * - Take selected procedural items at time `t`
 * - Resolve time-dependent properties (animation, fades, styles)
 *
 * Does NOT:
 * - Select items by time
 * - Render pixels
 * - Create VideoFrame or AudioData
 * - Perform composition
 *
 * NOTE:
 * This stage is intentionally empty in early architecture.
 * Selection currently emits fully usable items.
 * Logic will be migrated here incrementally.
 */

export function resolveProceduralSelection({ timeSeconds, items }) {

    if (!Array.isArray(items)) {
        throw new Error(
            "resolveProceduralSelection: expected items array"
        );
    }

    return {
        timeSeconds,
        items
    };
}
