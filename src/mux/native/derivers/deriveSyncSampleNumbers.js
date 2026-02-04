/**
 * deriveSyncSampleNumbers
 * ======================
 *
 * Derives semantic sync sample (keyframe) numbers from samples.
 *
 * This function is:
 * - Pure
 * - Deterministic
 * - Semantic (not container-aware)
 *
 * Contract:
 *
 * If ANY sample has an `isKey` boolean:
 *   → keyframe semantics are known
 *   → return { status: "present", sampleNumbers: [...] }
 *
 * If NO samples have `isKey`:
 *   → keyframe semantics are unknown
 *   → return { status: "not present", sampleNumbers: false }
 *
 * Sample numbers are 1-based (MP4 spec).
 */
export function deriveSyncSampleNumbers({ samples }) {

    if (!Array.isArray(samples)) {
        throw new Error("deriveSyncSampleNumbers: samples must be an array");
    }

    // ---------------------------------------------------------
    // Detect whether keyframe semantics exist at all
    // ---------------------------------------------------------
    const hasKeyInfo = samples.some(s => typeof s.isKey === "boolean");

    if (!hasKeyInfo) {
        return {
            status: "not present",
            syncSampleNumbers: false,
            totalSampleCount: samples.length
        };
    }

    // ---------------------------------------------------------
    // Derive sync sample numbers (1-based)
    // ---------------------------------------------------------
    const sampleNumbers = [];

    for (let i = 0; i < samples.length; i++) {
        if (samples[i].isKey === true) {
            sampleNumbers.push(i + 1);
        }
    }

    return {
        status: "present",
        syncSampleNumbers: sampleNumbers,
        totalSampleCount: samples.length
    };
}
