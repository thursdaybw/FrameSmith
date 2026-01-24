/**
 * applySyncRepresentationPolicy
 *
 * Decide how (or whether) sync semantics are buildHints.syncRepresentationresented for a track.
 *
 * This policy determines whether an STSS box should be emitted.
 *
 * It does NOT:
 * - derive sync information
 * - emit MP4 boxes
 * - interpret codec bitstreams
 *
 * Priority order:
 *   1. Explicit sample-group intent suppresses STSS
 *   2. Explicit STSS passthrough wins
 *   3. Derived sync samples may produce STSS
 *   4. Otherwise, no sync buildHints.syncRepresentationresentation is emitted
 */
export function applySyncRepresentationPolicy({
    derivedSyncSampleNumbers,
    buildHints
}) {

    console.log(
        "[applySyncRepresentationPolicy] input",
        {
            status: derivedSyncSampleNumbers.status,
            syncCount: derivedSyncSampleNumbers.syncSampleNumbers.length,
            total: derivedSyncSampleNumbers.totalSampleCount,
            requested: buildHints.syncRepresentation?.kind
        }
    );

    if (!derivedSyncSampleNumbers) {
        throw new Error(
            "applySyncRepresentationPolicy: derivedSyncSampleNumbers is required"
        );
    }

    // ---------------------------------------------------------
    // Suppress ONLY derived STSS when all samples are sync
    // ---------------------------------------------------------
    if (
        derivedSyncSampleNumbers.status === "present" &&
        derivedSyncSampleNumbers.syncSampleNumbers.length ===
        derivedSyncSampleNumbers.totalSampleCount &&
        buildHints.syncRepresentation == null
    ) {
        return { kind: "none" };
    }

    // ---------------------------------------------------------
    // Explicit STSS instruction — authoritative
    // ---------------------------------------------------------
    if (
        buildHints.syncRepresentation?.kind === "stss" &&
        buildHints.syncRepresentation.emitStssSampleNumbersUnmodified === true
    ) {
        console.log(
            "[applySyncRepresentationPolicy] emitting STSS",
            {
                sampleNumbers: derivedSyncSampleNumbers.sampleNumbers
            }
        );
        return buildHints.syncRepresentation;
    }
    else {
        return buildHints.syncRepresentation;
    }

    // ---------------------------------------------------------
    // No sync buildHints.syncRepresentationresentation
    // ---------------------------------------------------------
    return { kind: "none" };
}
