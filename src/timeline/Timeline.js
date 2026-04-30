import { createId } from "../core/identity/createId.js";

/**
 * Timeline
 *
 * The top-level structural container for compilation.
 *
 * CURRENT STAGE RESPONSIBILITIES:
 * - Own tracks
 * - Define overall duration
 *
 * INTENTIONALLY OUT OF SCOPE *FOR THIS STAGE*:
 * - Media decoding
 * - Rendering
 * - Playback or preview concerns
 *
 * NOTES:
 * - Timeline evaluation is performed by walking clips and access units.
 * - Time-based querying will reappear in later, higher-level stages.
 */
export class Timeline {

    constructor(duration) {
        this.id = createId(); // Engine identity (opaque, stable)
        this.tracks = [];
        this.duration = duration;
    }

    addTrack(track) {
        this.tracks.push(track);
    }

}
