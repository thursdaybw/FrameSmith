/**
 * assembleStsd
 * ===========
 *
 * Assembler for stsd (Sample Description Box).
 *
 * Responsibilities:
 * - Validate builder intent
 * - Validate SampleEntry children
 * - Derive sampleEntryCount
 * - Emit stsd container via emitContainer
 */

export function assembleStsd(intent, { emitContainer }) {

    // ---------------------------------------------------------
    // Shape validation
    // ---------------------------------------------------------
    if (typeof intent !== "object" || intent === null) {
        throw new Error("assembleStsd: intent must be an object");
    }

    const allowedKeys = ["sampleEntries"];
    const actualKeys = Object.keys(intent);

    for (const key of actualKeys) {
        if (!allowedKeys.includes(key)) {
            throw new Error(
                `assembleStsd: unexpected field '${key}'. ` +
                `Allowed fields: ${allowedKeys.join(", ")}`
            );
        }
    }

    const { sampleEntries } = intent;

    // ---------------------------------------------------------
    // Required sampleEntries array
    // ---------------------------------------------------------
    if (!Array.isArray(sampleEntries) || sampleEntries.length === 0) {
        throw new Error(
            "assembleStsd: sampleEntries must be a non-empty array of SampleEntry nodes"
        );
    }

    // ---------------------------------------------------------
    // Validate SampleEntry children
    // ---------------------------------------------------------
    for (let i = 0; i < sampleEntries.length; i++) {
        const entry = sampleEntries[i];

        if (typeof entry !== "object" || entry === null) {
            throw new Error(
                `assembleStsd: sampleEntries[${i}] must be an object`
            );
        }

        if (typeof entry.type !== "string") {
            throw new Error(
                `assembleStsd: sampleEntries[${i}] is missing a valid 'type' field`
            );
        }
    }

    // ---------------------------------------------------------
    // Derive sampleEntryCount
    // ---------------------------------------------------------
    const sampleEntryCount = sampleEntries.length;

    // ---------------------------------------------------------
    // Emit stsd container
    // ---------------------------------------------------------
    return emitContainer(
        "moov/trak/mdia/minf/stbl/stsd",
        {
            sampleEntryCount,
            sampleEntries
        }
    );
}

export function registerStsdAssembler(registry) {
    registry.registerAssembler(
        "moov/trak/mdia/minf/stbl/stsd",
        assembleStsd
    );
}
