export function adaptStszFromSamples({ samples }) {

    if (!Array.isArray(samples)) {
        throw new Error(
            "adaptStszFromSamples: samples must be an array"
        );
    }

    const sizes = [];

    for (let i = 0; i < samples.length; i++) {
        const s = samples[i];

        if (!(s.bytes instanceof Uint8Array)) {
            throw new Error(
                `adaptStszFromSamples: sample ${i} missing bytes`
            );
        }

        sizes.push(s.bytes.length);
    }

    return {
        sizes
    };
}
