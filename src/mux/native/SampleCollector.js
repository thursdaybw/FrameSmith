import { describeValue } from "./diagnostic/describeValue.js";

export class SampleCollector {

    constructor() {
        this.samples = [];
        this.totalMdatSize = 0;
    }

    /**
     * Add a sample into the collector.
     *
     * {
     *   data: Uint8Array,
     *   size: number,
     *   isKey: boolean,
     *   timestampMicroseconds: number,
     *   durationMicroseconds: number
     * }
     */
    addSample({ 
        data, 
        size, 
        isKey, 
        timestampMicroseconds, 
        durationMicroseconds 
    }) {

        // Validation
        if (!(data instanceof Uint8Array)) {
            throw new Error(
                `SampleCollector.addSample: data must be Uint8Array, received ${describeValue(Uint8Array)}`
            );
        }

        if (typeof size !== "number" || size !== data.length) {
            throw new Error("SampleCollector.addSample: size must equal data.length");
        }

        if (typeof timestampMicroseconds !== "number" || Number.isNaN(timestampMicroseconds)) {
            throw new Error(
                `SampleCollector.addSample: timestampMicroseconds must be numeric, received ${describeValue(timestampMicroseconds)}`
            );
        }

        if (typeof durationMicroseconds !== "number" || Number.isNaN(durationMicroseconds)) {
            throw new Error(
                `SampleCollector.addSample: durationMicroseconds must be numeric, received ${describeValue(durationMicroseconds)}`
            );
        }

        // Clone to protect internal state
        const cloned = data.slice();

        this.samples.push({
            data: cloned,
            size: cloned.length,
            isKey: !!isKey,
            timestampMicroseconds,
            durationMicroseconds
        });

        this.totalMdatSize += cloned.length;
    }

    /**
     * Defensive copy of samples.
     */
    freeze() {
        return this.samples.map(s => ({
            data: s.data.slice(),
            size: s.size,
            isKey: s.isKey,
            timestampMicroseconds: s.timestampMicroseconds,
            durationMicroseconds: s.durationMicroseconds
        }));
    }

}
