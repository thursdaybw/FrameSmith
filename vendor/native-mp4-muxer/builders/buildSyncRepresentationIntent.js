export function buildSyncRepresentationIntent(syncRepresentation) {

    if (!syncRepresentation || syncRepresentation.kind === "none") {
        return null;
    }

    if (syncRepresentation.kind === "stss") {
        return {
            stss: {
                sampleNumbers: syncRepresentation.sampleNumbers
            }
        };
    }

    if (syncRepresentation.kind === "sgpd/sbgp") {
        return {
            sgpd: syncRepresentation.sgpdData,
            sbgp: syncRepresentation.sbgpData
        };
    }

    throw new Error(
        "buildSyncRepresentationIntent: unsupported kind " +
        syncRepresentation.kind
    );
}
