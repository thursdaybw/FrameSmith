
// -----------------------------------------------------------------------------
// Unified entry to resolver.
// -----------------------------------------------------------------------------
export function resolveByPathToBoxAndContainingTrackTHIS_IS_DEAD_CODE(mp4Bytes, path) {

    console.log('resolveByPathToBoxAndContainingTrack incoming path', path);

    if (path === "moov/trak" || path === "moov/trak/") {
        throw new Error(
            "Invalid traversal path 'moov/trak'. " +
            "Tracks must be indexed using trak[n]."
        );
    }

    // ---------------------------------------------------------
    // Grammar enforcement phase (NO traversal)
    // ---------------------------------------------------------
    enforceRootPathGrammar(path);
    enforceIndexedTrakGrammar(path);

    // -------------------------------------------------------------
    // Track-scoped resolution
    // -------------------------------------------------------------
    if (path.includes("moov/trak[")) {
        return resolveWithinTrak(mp4Bytes, path);
    }

    // -------------------------------------------------------------
    // Root-level resolution
    // -------------------------------------------------------------
    const registryPath = stripTrailingSlash(stripBracketSelectors(path));

    console.log('resolveByPathToBoxAndContainingTrack path normalised to registryPath', registryPath);

    let boxBytes;
    try {
        boxBytes = resolveSingleBoxFromMp4(mp4Bytes, path);
    } catch (e) {
         console.log('resolveByPathToBoxAndContainingTrack no bytes, exception caught', e);
        // Legal root-level box absent → explicit absence
        return {
            exists: false,
            registryPath,
            boxBytes: null,
            containingTrack: null
        };
    }

    console.log('resolveByPathToBoxAndContainingTrack bytes from registryPath', boxBytes);
    return {
        exists: true,
        registryPath,
        boxBytes,
        containingTrack: null
    };
}

function readTrackHandlerTypeFromHdlr(trakBytes) {

    const report = getGoldenTruthBox.getSemanticBoxDataFromBox({
                boxBytes: trakBytes,
                sourceRegistryKey: "moov/trak",
                targetBoxPath: "moov/trak/mdia/hdlr"
            }).readBoxReport();

    return report.box.fields.handlerType;
}

function resolveWithinTrak(mp4Bytes, path) {

    const containingTrack = resolveTrakFromPath(mp4Bytes, path);

    // ---------------------------------------------
    // Legal but absent trak[n]
    // ---------------------------------------------
    if (containingTrack === null) {
        return {
            exists: false,
            registryPath: "moov/trak",
            boxBytes: null,
            containingTrack: null
        };
    }

    if (!(containingTrack instanceof Uint8Array)) {
        throw new Error(
            "resolveWithinTrak: resolveTrakFromPath did not return Uint8Array\n" +
            `Received: ${Object.prototype.toString.call(containingTrack)}`
        );
    }

    const remainingPath =
        path.replace(/^moov\/trak\[\d+\]\/?/, "");

    // ---------------------------------------------------------
    // TERMINAL trak resolution (moov/trak[n])
    // ---------------------------------------------------------
    if (remainingPath === "") {
        return {
            exists: true,
            registryPath: "moov/trak",
            boxBytes: containingTrack,
            containingTrack
        };
    }

    // ---------------------------------------------------------
    // MINF divergence enforcement
    // ---------------------------------------------------------
    enforceMinfDivergenceWithinTrak({ containingTrack, remainingPath });

    // ---------------------------------------------------------
    // SampleEntry resolution
    // ---------------------------------------------------------
    const sampleResult = resolveSampleEntryWithinTrak({ containingTrack, remainingPath, fullPath: path });

    if (sampleResult) {
        return {
            exists: true,
            registryPath: sampleResult.registryPath,
            boxBytes: sampleResult.boxBytes,
            containingTrack
        };
    }

    // ---------------------------------------------------------
    // Normal ISO container traversal (optional-aware)
    // ---------------------------------------------------------
    const isoResult = resolveOptionalIsoChildWithinTrak({ containingTrack, remainingPath, fullPath: path });

    if (isoResult.boxBytes === undefined) {
        return {
            exists: false,
            registryPath: isoResult.registryPath,
            boxBytes: null,
            containingTrack
        };
    }

    return {
        exists: true,
        registryPath: isoResult.registryPath,
        boxBytes: isoResult.boxBytes,
        containingTrack
    };
}

function resolveWithinTrak(mp4Bytes, path) {

    const containingTrack = resolveTrakFromPath(mp4Bytes, path);

    // ---------------------------------------------
    // Legal but absent trak[n]
    // ---------------------------------------------
    if (containingTrack === null) {
        return {
            exists: false,
            registryPath: "moov/trak",
            boxBytes: null,
            containingTrack: null
        };
    }

    if (!(containingTrack instanceof Uint8Array)) {
        throw new Error(
            "resolveWithinTrak: resolveTrakFromPath did not return Uint8Array\n" +
            `Received: ${Object.prototype.toString.call(containingTrack)}`
        );
    }

    const remainingPath =
        path.replace(/^moov\/trak\[\d+\]\/?/, "");

    // ---------------------------------------------------------
    // TERMINAL trak resolution (moov/trak[n])
    // ---------------------------------------------------------
    if (remainingPath === "") {
        return {
            exists: true,
            registryPath: "moov/trak",
            boxBytes: containingTrack,
            containingTrack
        };
    }

    // ---------------------------------------------------------
    // MINF divergence enforcement
    // ---------------------------------------------------------
    enforceMinfDivergenceWithinTrak({ containingTrack, remainingPath });

    // ---------------------------------------------------------
    // SampleEntry resolution
    // ---------------------------------------------------------
    const sampleResult = resolveSampleEntryWithinTrak({ containingTrack, remainingPath, fullPath: path });

    if (sampleResult) {
        return {
            exists: true,
            registryPath: sampleResult.registryPath,
            boxBytes: sampleResult.boxBytes,
            containingTrack
        };
    }

    // ---------------------------------------------------------
    // Normal ISO container traversal (optional-aware)
    // ---------------------------------------------------------
    const isoResult = resolveOptionalIsoChildWithinTrak({ containingTrack, remainingPath, fullPath: path });

    if (isoResult.boxBytes === undefined) {
        return {
            exists: false,
            registryPath: isoResult.registryPath,
            boxBytes: null,
            containingTrack
        };
    }

    return {
        exists: true,
        registryPath: isoResult.registryPath,
        boxBytes: isoResult.boxBytes,
        containingTrack
    };
}

function resolveOptionalIsoChildWithinTrak({
    containingTrack,
    remainingPath,
    fullPath
}) {

    const registryKey = stripTrailingSlash(stripBracketSelectors(`moov/trak/${remainingPath}`));

    if (registryKey === "moov/trak" || registryKey === "moov/trak/") {
        throw new Error(
            "Internal error: registryPath 'moov/trak' is not a valid box identity.\n" +
            "Tracks must be indexed using trak[n]."
        );
    }

    const boxBytes =
        resolveOptionalSingleIsoChild({
            containerBytes: containingTrack,
            traversalPath: remainingPath,
            fullPathForError: fullPath,
            registryPathPrefix: registryKey
        });

    if (boxBytes === undefined) {
        return {
            boxBytes: undefined,
            registryPath: registryKey
        };
    }

    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error(
            `resolveByPathToBoxAndContainingTrack: registryKey (${registryKey}) resolved to non-Uint8Array\n` +
            `Received: ${Object.prototype.toString.call(boxBytes)}`
        );
    }

    return {
        boxBytes,
        registryPath: registryKey
    };
}

function enforceMinfDivergenceWithinTrak({
    containingTrack,
    remainingPath
}) {

    if (!remainingPath.startsWith("mdia/minf/")) {
        return;
    }

    const hdlr =
        getGoldenTruthBox.getSemanticBoxDataFromBox({
            boxBytes: containingTrack,
            sourceRegistryKey: "moov/trak",
            targetBoxPath: "moov/trak/mdia/hdlr"
        });

    const handlerType =
        hdlr.readBoxReport().box.fields.handlerType;

    if (handlerType === "vide" && remainingPath.startsWith("mdia/minf/smhd")) {
        throw new Error("Video track does not contain smhd");
    }

    if (handlerType === "soun" && remainingPath.startsWith("mdia/minf/vmhd")) {
        throw new Error("Audio track does not contain vmhd");
    }
}

function resolveSampleEntryWithinTrak({
    containingTrack,
    remainingPath,
    fullPath
}) {

    // ---------------------------------------------------------
    // Reject illegal direct SampleEntry selectors (stsd/<codec>)
    // ---------------------------------------------------------
    if (
        remainingPath.startsWith("mdia/minf/stbl/stsd/") &&
        !remainingPath.startsWith("mdia/minf/stbl/stsd/sample[")
    ) {
        throw new Error(
            [
                "You tried to access sample entries using 'sample'.",
                "",
                "You must instead select a specific sample entry using its index, like so:",
                "  /sample[0]"
            ].join("\n")
        );
    }

    // ---------------------------------------------------------
    // SampleEntry schema boundary (|)
    // ---------------------------------------------------------
    if (remainingPath.includes("|")) {

        const stsdBoxes = findTraversalNodesByPathFromBoxBytes({
            boxBytes: containingTrack,
            path: "mdia/minf/stbl/stsd",
            baseRegistryPath: "moov/trak"
        });

        if (stsdBoxes.length !== 1) {
            throw new Error(
                `Expected exactly one stsd box in trak, found ${stsdBoxes.length}`
            );
        }

        const stsdBox = stsdBoxes[0];

        const match =
            remainingPath.match(/^stsd\|([^/]+)(?:\/(.*))?$/);

        if (!match) {
            throw new Error(
                [
                    "Invalid SampleEntry selector.",
                    "",
                    "SampleEntries must be addressed using index-based grammar:",
                    "  stsd/sample[n]",
                    "",
                    "Internal SampleEntry grammar (using '|') is not valid input.",
                    "",
                    "Offending input path:",
                    `  ${fullPath}`
                ].join("\n")
            );
        }

        const [, sampleType, child] = match;

        const sampleEntries =
            getSampleEntryTableFromStsdAsList(stsdBox);

        const entry =
            sampleEntries.find(e => e.type === sampleType);

        if (!entry) {
            throw new Error(
                `SampleEntry '${sampleType}' not found in stsd`
            );
        }

        const sampleEntryBytes =
            stsdBox.slice(
                entry.offset,
                entry.offset + entry.size
            );

        if (!child) {
            return {
                boxBytes: sampleEntryBytes,
                registryPath:
                    `moov/trak/mdia/minf/stbl/stsd|${sampleType}`
            };
        }

        const cursor =
            new SampleEntryCursor(sampleEntryBytes);

        const headerSize =
            getSampleEntryHeaderSize(sampleType);

        const childBox =
            cursor.getChildBox({
                headerSize,
                fourcc: child
            });

        if (!childBox) {
            throw new Error(
                `SampleEntry '${sampleType}' does not contain child '${child}'`
            );
        }

        return {
            boxBytes: childBox,
            registryPath:
                `moov/trak/mdia/minf/stbl/stsd|${sampleType}/${child}`
        };
    }

    // ---------------------------------------------------------
    // SampleEntry grammar (stsd/sample[n])
    // ---------------------------------------------------------
    if (
        remainingPath.startsWith("mdia/minf/stbl/stsd/sample[") ||
        remainingPath.startsWith("stsd/sample[")
    ) {

        const result =
            resolveSampleEntryFromTrak(
                containingTrack,
                remainingPath
            );

        // TERMINAL sample entry
        if (!result.remainingPath) {
            return {
                boxBytes: result.sampleEntryBytes,
                registryPath:
                    `moov/trak/mdia/minf/stbl/stsd|${result.codec}`
            };
        }

        const child = result.remainingPath;

        if (result.codec === "mp4a" && child === "avcC") {
            throw new Error(
                "SampleEntry 'mp4a' does not contain child 'avcC'"
            );
        }

        if (result.codec === "avc1" && child === "esds") {
            throw new Error(
                "SampleEntry 'avc1' does not contain child 'esds'"
            );
        }

        const cursor =
            new SampleEntryCursor(result.sampleEntryBytes);

        const headerSize =
            getSampleEntryHeaderSize(result.codec);

        const childBox =
            cursor.getChildBox({
                headerSize,
                fourcc: child
            });

        if (!childBox) {
            throw new Error(
                `SampleEntry '${result.codec}' does not contain child '${child}'`
            );
        }

        return {
            boxBytes: childBox,
            registryPath:
                `moov/trak/mdia/minf/stbl/stsd|${result.codec}/${child}`
        };
    }

    return null;
}

function resolveOptionalSingleIsoChild({
    containerBytes,
    traversalPath,
    fullPathForError
}) {
    let matches;

    try {
        matches = findTraversalNodesByPathFromBoxBytes({
            boxBytes: containerBytes,
            path: traversalPath,
            baseRegistryPath: "moov/trak"
        });
    } catch (e) {
        // OPTIONAL CHILD ABSENT → do not throw
        return undefined;
    }

    if (matches.length === 0) {
        return undefined;
    }

    if (matches.length > 1) {
        throw new Error(
            `Expected exactly one box at '${fullPathForError}', found ${matches.length}`
        );
    }

    return matches[0].boxBytes;
}

function rewriteSampleSelectorPath({
    fullPath,
    sampleIndex,
    concreteSampleType
}) {
    // fullPath is stsd-relative or mdia/minf/stbl-relative
    // We must replace:
    //   stsd/sample[n]      → stsd|<codec>
    //   stsd/sample[n]/foo  → stsd|<codec>/foo

    const sampleToken = `sample[${sampleIndex}]`;

    if (!fullPath.includes(sampleToken)) {
        throw new Error(
            `rewriteSampleSelectorPath: missing ${sampleToken} in '${fullPath}'`
        );
    }

    // Split once at sample[n]
    const [before, after] = fullPath.split(sampleToken);

    // before ends with ".../stsd/"
    // Normalize to STSD-relative path only
    const stsdPath = "stsd";

    // after is either "" or "/child/..."
    const child =
        after.startsWith("/")
        ? after.slice(1)
        : after;

    // Build SampleEntry traversal grammar
    return child
        ? `${stsdPath}|${concreteSampleType}/${child}`
        : `${stsdPath}|${concreteSampleType}`;
}

// -----------------------------------------------------------------------------
// Grammar
// -----------------------------------------------------------------------------

function enforceIndexedTrakGrammar(path) {
    if (!path.includes("moov/trak")) {
        return;
    }

    const bad =
        path.includes("moov/trak/") &&
        !path.includes("moov/trak[");

    if (bad) {
        throw new Error(
            "Path traverses moov/trak but does not specify an index. " +
            "Use trak[n]."
        );
    }
}

// -----------------------------------------------------------------------------
// Track resolution
// -----------------------------------------------------------------------------
function resolveTrakFromPath(mp4Bytes, path) {
    const match = path.match(/trak\[(\d+)\]/);

    if (!match) {
        throw new Error("Invalid trak index syntax");
    }

    const index = Number(match[1]);

    const traks = findBoxesByPathFromMp4(mp4Bytes, "moov/trak");

    if (traks.length === 0) {
        throw new Error("No trak boxes found in MP4");
    }

    if (!Number.isInteger(index)) {
        throw new Error(`Invalid trak index '${index}'`);
    }

    if (index < 0 || index >= traks.length) {
        return null; // legal but absent
    }

    const trakBytes = traks[index];

    if (!(trakBytes instanceof Uint8Array)) {
        throw new Error(
            "resolveTrakFromPath: expected Uint8Array from findBoxesByPathFromMp4\n" +
            `Received: ${Object.prototype.toString.call(trakBytes)}`
        );
    }

    return trakBytes;
}

// -----------------------------------------------------------------------------
// Single box resolution
// -----------------------------------------------------------------------------

function resolveSingleBoxFromMp4(mp4Bytes, path) {
    console.log('resolveSingleBoxFromMp4 incoming path', path); 
    const boxes = findBoxesByPathFromMp4(mp4Bytes, path);

    console.log('resolveSingleBoxFromMp4 found boxes', boxes); 

    if (boxes.length !== 1) {
        throw new Error(
            `Expected exactly one box at '${path}', found ${boxes.length}`
        );
    }

    return boxes[0];
}

function resolveSingleBoxFromBox(boxBytes, path) {
    const boxes = findTraversalNodesByPathFromBoxBytes(boxBytes, path);

    if (boxes.length !== 1) {
        throw new Error(
            `Expected exactly one box at '${path}', found ${boxes.length}`
        );
    }

    return boxes[0];
}

    /*
    getSemanticBoxDataByPathFromMp4File(mp4Bytes, path, options = {}) {

        if (!(mp4Bytes instanceof Uint8Array)) {
            throw new Error(
                "getSemanticBoxDataByPathFromMp4File: mp4Bytes must be a Uint8Array\n" +
                `Received: ${Object.prototype.toString.call(mp4Bytes)}`
            );
        }

        if (typeof path !== "string" || path.length === 0) {
            throw new Error(
                "getSemanticBoxDataByPathFromMp4File: path must be a non-empty string\n" +
                `Received: ${typeof path} (${String(path)})`
            );
        }

        if (options !== undefined && (typeof options !== "object" || options === null)) {
            throw new Error(
                "getSemanticBoxDataByPathFromMp4File: options must be an object if provided\n" +
                `Received: ${Object.prototype.toString.call(options)}`
            );
        }

        const resolvedBox = resolveByPathToBoxAndContainingTrack(mp4Bytes, path);


// OPTIONAL CHILD ABSENT → return undefined
        if (resolvedBox.boxBytes === undefined) {
            throw new Error(
                "getSemanticBoxDataByPathFromMp4File: traversal resolved to undefined boxBytes\n" +
                `path: ${path}\n` +
                `registryPath: ${resolvedBox.registryPath}`
            );
            return undefined;
        }

        const registryPath =
            resolvedBox.registryPath ??
            stripBracketSelectors(path);

        return GoldenTruthFinalizer.finalize({
            registryPath,
            boxBytes: resolvedBox.boxBytes,
            containingTrack: resolvedBox.containingTrack,
            mp4Bytes,
            path,
            options
        });

    },
    */

