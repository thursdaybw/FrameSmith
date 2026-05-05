export function applySyncRepresentationPolicy({
    derivedSyncSampleNumbers,
    buildHints
}) {

    if (!derivedSyncSampleNumbers) {
        throw new Error(
            "applySyncRepresentationPolicy: derivedSyncSampleNumbers is required"
        );
    }

    const syncHint =
        buildHints && buildHints.syncRepresentation
            ? buildHints.syncRepresentation
            : null;

    // ---------------------------------------------------------
    // Explicit sample-grouping (sgpd/sbgp) — authoritative
    // ---------------------------------------------------------
    if (
        syncHint !== null &&
        syncHint.kind === "sgpd/sbgp"
    ) {
        return syncHint;
    }

    // ---------------------------------------------------------
    // Suppress derived STSS when all samples are sync
    // ---------------------------------------------------------
    if (
        derivedSyncSampleNumbers.status === "present" &&
        derivedSyncSampleNumbers.syncSampleNumbers.length ===
            derivedSyncSampleNumbers.totalSampleCount &&
        syncHint === null
    ) {
        return { kind: "none" };
    }

    // ---------------------------------------------------------
    // Explicit STSS passthrough — authoritative
    // ---------------------------------------------------------
    if (
        syncHint !== null &&
        syncHint.kind === "stss" &&
        syncHint.emitStssSampleNumbersUnmodified === true
    ) {
        return syncHint;
    }

    // ---------------------------------------------------------
    // Default: no sync representation
    // ---------------------------------------------------------
    return { kind: "none" };
}
