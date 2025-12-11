import { describeValue } from "./diagnostic/describeValue.js";

export class TimingModel {

    constructor(framesPerSecond) {
        if (typeof framesPerSecond !== "number" || framesPerSecond <= 0) {
            throw new Error("TimingModel requires a positive numeric fps value");
        }

        this.framesPerSecond = framesPerSecond;
        this.ticksPerSecond = 90000;
        this.durationPerFrame = Math.floor(this.ticksPerSecond / framesPerSecond);

        this.frameCount = 0;
        this.lastTimestampTicks = 0;

        this.isFinalized = false;
    }

    /**
     * Convert a timestamp from microseconds to MP4 timebase ticks.
     * ticks = microseconds * 90 / 1000
     */
    convertMicrosecondsToTicks(us) {
        return Math.round(us * 90 / 1000);
    }

    /**
     * Add a frame to the timeline.
     * timestampUs is for validation and optional use, we primarily rely on frameCount.
     */
    addFrame(timestampUs) {
        if (this.isFinalized) {
            throw new Error("TimingModel: cannot add frames after finalize()");
        }

        if (typeof timestampUs !== "number" || Number.isNaN(timestampUs)) {
            throw new Error(
                `TimingModel.addFrame: timestampUs must be numeric, received ${describeValue(timestampUs)}`
            );
        }
        // Convert timestamp to ticks for callers who need ordering checks
        this.lastTimestampTicks = this.convertMicrosecondsToTicks(timestampUs);

        // Increase frame count. Each frame contributes one fixed duration.
        this.frameCount++;
    }

    /**
     * Finalize the model.
     * Returns an object with:
     *   sttsEntries: [ { sampleCount, sampleDuration } ]
     *   totalDuration
     */
    finalize() {
        if (this.isFinalized) {
            throw new Error("TimingModel: finalize() already called");
        }

        this.isFinalized = true;

        const sampleCount = this.frameCount;
        const sampleDuration = this.durationPerFrame;
        const totalDuration = sampleCount * sampleDuration;

        return {
            sttsEntries: [
                {
                    sampleCount,
                    sampleDuration
                }
            ],
            totalDuration
        };
    }

}
