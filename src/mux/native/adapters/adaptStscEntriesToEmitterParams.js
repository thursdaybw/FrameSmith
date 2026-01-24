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

    const out = {
        entries: []
    };

    for (let i = 0; i < entries.length; i++) {
        const e = entries[i];

        out.entries.push({
            firstChunk: e.firstChunk,
            samplesPerChunk: e.samplesPerChunk,
            sampleDescriptionIndex: e.sampleDescriptionIndex
        });
    }

    return out;

}
