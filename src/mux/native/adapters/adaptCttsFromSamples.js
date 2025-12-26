/**
 * CTTS Adapter — Semantic → Structural
 * -----------------------------------
 *
 * Derives CTTS entries from semantic samples.
 *
 * Responsibilities:
 * - Read per-sample composition offsets
 * - Run-length encode identical consecutive offsets
 * - Preserve exact ordering and values
 *
 * Non-responsibilities:
 * - No defaulting
 * - No collapsing
 * - No CFR assumptions
 * - No mutation
 *
 * Requires:
 *   sample.dts
 *   sample.pts
 *
 * Output shape:
 *   {
 *     entries: [
 *       { count: number, offset: number }
 *     ]
 *   }
 *
 */
export function adaptCttsFromSamples({ samples }) {

    if (!Array.isArray(samples)) {
        throw new Error(
            "adaptCttsFromSamples: expected samples array"
        );
    }

    if (samples.length === 0) {
        return { entries: [] };
    }

    // ---------------------------------------------------------
    // Compute composition offsets
    // ---------------------------------------------------------
    const offsets = samples.map((sample, index) => {

        if (!Number.isInteger(sample.dts)) {
            throw new Error(
                `adaptCttsFromSamples: samples[${index}].dts must be an integer`
            );
        }

        if (!Number.isInteger(sample.pts)) {
            throw new Error(
                `adaptCttsFromSamples: samples[${index}].pts must be an integer`
            );
        }

        const offset = sample.pts - sample.dts;

        if (offset < 0) {
            throw new Error(
                `adaptCttsFromSamples: negative composition offset at sample ${index} (version 0 unsupported)`
            );
        }

        return offset;
    });

    // ---------------------------------------------------------
    // Run-length encode
    // ---------------------------------------------------------
    const entries = [];

    let currentOffset = offsets[0];
    let count = 1;

    for (let i = 1; i < offsets.length; i++) {
        const offset = offsets[i];

        if (offset === currentOffset) {
            count++;
        } else {
            entries.push({
                count,
                offset: currentOffset
            });
            currentOffset = offset;
            count = 1;
        }
    }

    entries.push({
        count,
        offset: currentOffset
    });

    return { entries };
}
