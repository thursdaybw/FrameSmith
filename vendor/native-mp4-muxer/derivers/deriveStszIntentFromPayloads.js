export function deriveStszIntentFromPayloads({ accessUnits, accessUnitPayloads }) {

    if (!Array.isArray(accessUnits)) {
        throw new Error(
            "deriveStszIntentFromPayloads: accessUnits must be an array"
        );
    }

    if (!Array.isArray(accessUnitPayloads)) {
        throw new Error(
            "deriveStszIntentFromPayloads: accessUnitPayloads must be an array"
        );
    }

    if (accessUnits.length !== accessUnitPayloads.length) {
        throw new Error(
            [
                "deriveStszIntentFromPayloads: length mismatch",
                `accessUnits: ${accessUnits.length}`,
                `payloads: ${accessUnitPayloads.length}`
            ].join("\n")
        );
    }

    const sampleCount = accessUnitPayloads.length;

    if (sampleCount === 0) {
        return {
            sampleSize: 0,
            sampleCount: 0,
            sizes: []
        };
    }

    const sizes = [];
    let nominalSize = accessUnitPayloads[0].length;
    let isConstantSize = true;

    for (let i = 0; i < accessUnitPayloads.length; i++) {
        const payload = accessUnitPayloads[i];

        if (!(payload instanceof Uint8Array)) {
            throw new Error(
                `deriveStszIntentFromPayloads: payload[${i}] must be Uint8Array`
            );
        }

        sizes.push(payload.length);

        if (payload.length !== nominalSize) {
            isConstantSize = false;
        }
    }

    if (isConstantSize) {
        return {
            sampleSize: nominalSize,
            sampleCount
        };
    }

    return {
        sampleSize: 0,
        sampleCount,
        sizes
    };
}
