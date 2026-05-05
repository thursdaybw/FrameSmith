import { createId } from "./core/identity/createId.js";

/**
 * Clip
 *
 * A bounded time window over an underlying source
 * (e.g. a ContainerTrackView for container-backed media).
 *
 * CURRENT STAGE RESPONSIBILITIES:
 * - Define a start/end range in container time
 * - Filter access units that fall within that range
 *
 * INTENTIONALLY OUT OF SCOPE *FOR THIS STAGE*:
 * - Decoding media
 * - Rendering frames
 * - Sampling by wall-clock time
 *
 * NOTES:
 * - Clips do not answer "what happens at time t" at this stage.
 * - They only define which access units belong to the clip.
 * - Later stages interpret these units for render, preview, or export.
 */
export class Clip {
    constructor({ trackView, startSeconds, endSeconds, enabled = true }) {
        this.id = createId(); // Engine identity (opaque, stable)
        this.trackView = trackView;
        this.startPts = trackView.secondsToPts(startSeconds);
        this.endPts   = trackView.secondsToPts(endSeconds);
        this.enabled      = enabled; // engine-level gate
    }
    *iterateAccessUnits() {
        let yielded = false;

        for (const unit of this.trackView.iterateSamplesByPtsRange(
            this.startPts,
            this.endPts
        )) {
            yielded = true;
            yield unit;
        }

        if (!yielded) {
            throw new Error(
                "Clip: no samples exist in referenced time range"
            );
        }
    }
}


