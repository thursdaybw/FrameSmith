export function createIsoTraversalRequestFromBoxAndPath({
    sourceBoxBytes,
    sourceRegistryKey,
    targetBoxPath
}) {

    // ---------------------------------------------------------
    // Validate sourceBoxBytes
    // ---------------------------------------------------------
    if (!(sourceBoxBytes instanceof Uint8Array)) {
        throw new Error(
            "createIsoTraversalRequestFromBoxAndPath: sourceBoxBytes must be a Uint8Array"
        );
    }

    // ---------------------------------------------------------
    // Validate sourceRegistryKey
    // ---------------------------------------------------------
    if (typeof sourceRegistryKey !== "string" || sourceRegistryKey.length === 0) {
        throw new Error(
            "createIsoTraversalRequestFromBoxAndPath: sourceRegistryKey must be a non-empty string"
        );
    }

    // ---------------------------------------------------------
    // Validate targetBoxPath
    // ---------------------------------------------------------
    if (typeof targetBoxPath !== "string" || targetBoxPath.length === 0) {
        throw new Error(
            "createIsoTraversalRequestFromBoxAndPath: targetBoxPath must be a non-empty string"
        );
    }

    // ---------------------------------------------------------
    // Enforce plural-scope grammar
    // ---------------------------------------------------------

    // If we already refer to a concrete track, forbid trak[n]
    if ( sourceRegistryKey === "moov/trak" && /\/trak\[\d+\]/.test(targetBoxPath)) {
        throw new Error(
            [
                "Invalid path for the current context.",
                "",
                "You are already inside a specific track, so selecting another track by index is not allowed.",
                "",
                "Current context:",
                `  sourceRegistryKey = "${sourceRegistryKey}"`,
                "",
                "Invalid path:",
                `  ${targetBoxPath}`,
                "",
                "Why this is invalid:",
                "  trak[n] can only be used when starting from 'moov'.",
                "  Once you have a single track's bytes, there is no such thing as trak[1], trak[2], etc.",
                "",
                "Correct examples:",
                "  From moov:",
                "    moov/trak[0]/mdia/minf/stbl/stsd",
                "",
                "  From an existing track:",
                "    moov/trak/mdia/minf/stbl/stsd",
                "",
                "Fix:",
                "  Either drop the track index, or resolve the path starting from moov."
            ].join("\n")
        );
    }

    // If we are in a plural track context, require trak[n]
    if (
        (sourceRegistryKey === "$mp4" || sourceRegistryKey === "moov") &&
        /\/trak(\/|$)/.test(targetBoxPath) &&
        !/\/trak\[\d+\]/.test(targetBoxPath)
    ) {
        throw new Error(
            [
                "Invalid path for the current context.",
                "",
                "You are attempting to traverse 'trak' from a plural track container without selecting a track index.",
                "",
                "Current context:",
                `  sourceRegistryKey = "${sourceRegistryKey}"`,
                "",
                "Invalid path:",
                `  ${targetBoxPath}`,
                "",
                "Why this is invalid:",
                "  'trak' is a plural container and may contain multiple tracks.",
                "  The dispatcher must not guess which track you intend.",
                "",
                "Correct examples:",
                "  moov/trak[0]/mdia/minf/stbl/stsd",
                "  moov/trak[1]/mdia/hdlr",
                "",
                "Invalid examples:",
                "  moov/trak/mdia/minf/stbl/stsd",
                "",
                "Fix:",
                "  Specify an explicit track index using trak[n]."
            ].join("\n")
        );
    }

    // Reject bare sample selector (sample without [n])
    if (
        /\/sample(\/|$)/.test(targetBoxPath) &&
        !/\/sample\[\d+\]/.test(targetBoxPath)
    ) {
        throw new Error(
            [
                "Invalid sample selector.",
                "",
                "You attempted to use 'sample' without an index.",
                "",
                "Correct examples:",
                "  stsd/sample[0]",
                "  stsd/sample[1]/avcC",
            ].join("\n")
        );
    }

    // ---------------------------------------------------------
    // Preserve grammar verbatim
    // ---------------------------------------------------------
    const remainingTraversalPath = targetBoxPath;

    // ---------------------------------------------------------
    // Extract trackIndex (grammar only)
    // ---------------------------------------------------------
    let trackIndex = null;

    const trakMatch = remainingTraversalPath.match(/\/trak\[(\d+)\]/);
    if (trakMatch) {
        trackIndex = Number(trakMatch[1]);
    }

    // ---------------------------------------------------------
    // Extract sampleIndex (grammar only)
    // ---------------------------------------------------------
    let sampleIndex = null;

    const sampleMatch = remainingTraversalPath.match(/\/sample\[(\d+)\]/);
    if (sampleMatch) {
        sampleIndex = Number(sampleMatch[1]);
    }

    // ---------------------------------------------------------
    // Initialise unresolved identity
    // ---------------------------------------------------------
    const targetBoxIdentity = {
        resolved: false,
        key: null
    };

    // ---------------------------------------------------------
    // Return stable traversal request
    // ---------------------------------------------------------
    return {
        sourceBoxBytes,
        sourceRegistryKey,
        remainingTraversalPath,
        targetBoxIdentity,
        trackIndex,
        sampleIndex
    };
}

