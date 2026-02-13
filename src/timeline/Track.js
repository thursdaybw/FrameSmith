import { createId } from "../core/identity/createId.js";

/**
 * Track
 *
 * A Track is a structural grouping of Clips within the Timeline.
 *
 * Tracks define:
 * - ordering of clips
 * - overlap relationships
 * - relative layering when multiple clips are active
 *
 * Tracks do NOT define rendering semantics.
 *
 * In particular:
 * - A Track is not inherently "video", "audio", or "text"
 * - Rendering behavior is determined by the Assets and Clips
 *   placed on the Track, not by the Track itself
 *
 * Track typing, lane constraints, and media-specific rules
 * are editor-level concerns and must not leak into the
 * timeline compiler or pre-render execution.
 *
 * CURRENT STAGE RESPONSIBILITIES:
 * - Own clip ordering
 * - Provide structural grouping for timeline evaluation
 *
 * INTENTIONALLY OUT OF SCOPE:
 * - Media decoding
 * - Rendering
 * - Mixing or compositing
 * - Output domain decisions
 */
export class Track {
    constructor() {
        this.id = createId(); // Engine identity (opaque, stable)
        this.clips = [];
    }

    addClip(clip) {
        this.clips.push(clip);
    }
}
