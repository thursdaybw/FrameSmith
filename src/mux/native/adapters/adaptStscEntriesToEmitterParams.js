/**
 * Adapt semantic STSC entries into emitter parameters.
 *
 * Boundary:
 *   Semantic derivation → box emission
 *
 * This adapter exists to decouple:
 *   - chunk semantics
 *   - emitter input contracts
 *
 * Current constraint:
 *   - emitter supports exactly one STSC entry
 */
export function adaptStscEntriesToEmitterParams(entries) {

    if (!Array.isArray(entries)) {
        throw new Error(
            "adaptStscEntriesToEmitterParams: entries must be an array"
        );
    }

    if (entries.length !== 1) {
        throw new Error(
            "adaptStscEntriesToEmitterParams: STSC emitter currently supports exactly one entry"
        );
    }

    const entry = entries[0];

    return {
        firstChunk: entry.firstChunk,
        samplesPerChunk: entry.samplesPerChunk,
        sampleDescriptionIndex: entry.sampleDescriptionIndex
    };
}
