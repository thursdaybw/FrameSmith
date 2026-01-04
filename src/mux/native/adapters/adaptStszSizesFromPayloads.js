export function adaptStszSizesFromPayloads({
    accessUnits,
    accessUnitPayloads
}) {

    if (!Array.isArray(accessUnits)) {
        throw new Error(
            "adaptStszSizesFromPayloads: accessUnits must be an array"
        );
    }

    if (!Array.isArray(accessUnitPayloads)) {
        throw new Error(
            "adaptStszSizesFromPayloads: accessUnitPayloads must be an array"
        );
    }

    if (accessUnits.length !== accessUnitPayloads.length) {
        throw new Error(
            [
                "adaptStszSizesFromPayloads: length mismatch",
                `accessUnits: ${accessUnits.length}`,
                `payloads: ${accessUnitPayloads.length}`
            ].join("\n")
        );
    }

    const sizes = [];

    for (let i = 0; i < accessUnitPayloads.length; i++) {

        const payload = accessUnitPayloads[i];

        if (!(payload instanceof Uint8Array)) {
            throw new Error(
                `adaptStszSizesFromPayloads: payload[${i}] must be Uint8Array`
            );
        }

        sizes.push(payload.length);
    }

    return { sizes };
}
