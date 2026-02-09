/**
 * ContainerTrackView
 *
 * A lazy, queryable view over a single container-backed track
 * (e.g. one video or audio track inside an MP4).
 *
 * CURRENT STAGE RESPONSIBILITIES:
 * - Expose container timing (PTS/DTS/duration)
 * - Expose access-unit boundaries
 * - Allow deterministic iteration over access units
 *
 * INTENTIONALLY OUT OF SCOPE *FOR THIS STAGE*:
 * - Decoding access units into frames or PCM
 * - Rendering pixels or audio
 * - Timeline composition or clip logic
 *
 * NOTES:
 * - This is a container-level abstraction, not a full asset model.
 * - Other asset types (images, text, procedural sources) coexist
 *   elsewhere in FrameSmith and are evaluated in later stages.
 * - These exclusions are temporary boundaries, not architectural bans.
 */
export class ContainerTrackView {
    constructor({
        mediaType,
        containerMeta,
        codecConfig,
        semanticSamples,
        mp4Bytes
    }) {
        this.mediaType = mediaType; // "video" | "audio"

        this.containerMeta = containerMeta; // { trackTimescale, codedWidth?, codedHeight? }
        this.codecConfig = codecConfig;

        this._semanticSamples = semanticSamples;
        // array of { pts, dts, duration, size, offset, isKey }

        this._mp4Bytes = mp4Bytes;
    }

    // -------------------------
    // Metadata
    // -------------------------

    get sampleCount() {
        return this._semanticSamples.length;
    }

    ptsToSeconds(pts) {
        return pts / this.containerMeta.trackTimescale;
    }

    secondsToPts(seconds) {
        return Math.round(seconds * this.containerMeta.trackTimescale);
    }

    // -------------------------
    // Sample access (lazy)
    // -------------------------

    getSampleByIndex(index) {
        const s = this._semanticSamples[index];
        if (!s) return null;

        return {
            pts: s.pts,
            dts: s.dts,
            duration: s.duration,
            isKeyframe: s.isKey,
            data: this._mp4Bytes.slice(s.offset, s.offset + s.size)
        };
    }

    *iterateSamplesByPtsRange(startPts, endPts) {
        for (const s of this._semanticSamples) {
            if (s.pts < startPts) continue;
            if (s.pts > endPts) break;

            yield {
                pts: s.pts,
                dts: s.dts,
                duration: s.duration,
                isKeyframe: s.isKey,
                data: this._mp4Bytes.slice(s.offset, s.offset + s.size)
            };
        }
    }
}
