// ---------------------------------------------------------
// Root / grammar guards
// ---------------------------------------------------------

import {
    assertEqual,
    assertThrows,
    assertExists,
    assertNotExists,
} from "../assertions.js";

import {
} from "./GoldenTruthPathResolver.js";

import {
    getGoldenTruthBox
} from "./index.js";


// Rejects traversal path "moov/trak" because tracks must be indexed.
export async function testRejectsBareMoovTrak() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    let threw = false;

    try {
        resolveByPathToBoxAndContainingTrack(
            mp4,
            "moov/trak"
        );
    } catch (e) {
        threw = true;
    }

    assertEqual(
        "bare moov/trak is rejected",
        threw,
        true
    );
}

// Rejects traversal path "moov/trak/" because tracks must be indexed.
export async function testRejectsBareMoovTrakTrailingSlash() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    let threw = false;

    try {
        resolveByPathToBoxAndContainingTrack(
            mp4,
            "moov/trak/"
        );
    } catch (e) {
        threw = true;
    }

    assertEqual(
        "bare moov/trak/ is rejected",
        threw,
        true
    );
}

// Rejects any path that enters moov/trak without an explicit index.
export async function testRejectsPathWithoutIndexedTrak() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    let threw = false;

    try {
        resolveByPathToBoxAndContainingTrack(
            mp4,
            "moov/trak/mdia"
        );
    } catch (e) {
        threw = true;
    }

    assertEqual(
        "path entering trak without index is rejected",
        threw,
        true
    );
}

// Allows resolving "moov" and returns moov box bytes.
export async function testAllowsRootMoov() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const result = resolveByPathToBoxAndContainingTrack(
            mp4,
            "moov"
        );

    assertExists(
        "moov resolution returned object",
        result
    );

    assertExists(
        "moov boxBytes returned",
        result.boxBytes
    );

    assertEqual(
        "moov registryPath",
        result.registryPath,
        "moov"
    );

    assertEqual(
        "moov has no containingTrack",
        result.containingTrack,
        null
    );

    const report = getGoldenTruthBox
            .getSemanticBoxDataFromBox({
                boxBytes: result.boxBytes,
                sourceRegistryKey: "moov",
                targetBoxPath: "moov"
            })
            .readBoxReport();

    assertEqual(
        "resolved box type is moov",
        report.box.type,
        "moov"
    );
}

// ---------------------------------------------------------
// Trak resolution
// ---------------------------------------------------------

// Resolves moov/trak[n] to the correct trak box bytes.
export async function testResolvesIndexedTrakBytes() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    const result = resolveByPathToBoxAndContainingTrack(
            mp4Bytes,
            "moov/trak[0]"
        );

    assertExists("result.boxBytes", result.boxBytes);
    assertEqual(
        "boxBytes is Uint8Array",
        result.boxBytes instanceof Uint8Array,
        true
    );

    assertEqual(
        "registryPath for trak",
        result.registryPath,
        "moov/trak"
    );

    // For trak terminal resolution, containingTrack === boxBytes
    assertEqual(
        "containingTrack equals trak bytes",
        result.containingTrack,
        result.boxBytes
    );
}

// Throws when the requested trak index does not exist.
export async function testRejectsOutOfRangeTrakIndex() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    assertThrows(
        "out-of-range trak index throws",
        () => {
            resolveByPathToBoxAndContainingTrack(
                mp4Bytes,
                "moov/trak[999]"
            );
        },
        (err) =>
            err.message.includes("trak") ||
            err.message.includes("index") ||
            err.message.includes("out of range")
    );
}

// Resolving a non-existent trak returns exists:false
export async function testOutOfRangeTrakIndexReturnsAbsent() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4 = new Uint8Array(await resp.arrayBuffer());

    const result =
        resolveByPathToBoxAndContainingTrack(
            mp4,
            "moov/trak[999]"
        );

    assertExists("result returned", result);

    assertEqual(
        "trak[999] does not exist",
        result.exists,
        false
    );

    assertEqual(
        "boxBytes is null for absent trak",
        result.boxBytes,
        null
    );

    assertEqual(
        "containingTrack is null for absent trak",
        result.containingTrack,
        null
    );

    assertEqual(
        "registryPath is still canonical",
        result.registryPath,
        "moov/trak"
    );
}

// Sequential trak indexing stops once no further trak exists.
export async function testSequentialTrakIndexTerminates() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4 = new Uint8Array(await resp.arrayBuffer());

    // trak[0] exists
    const trak0 = resolveByPathToBoxAndContainingTrack(mp4, "moov/trak[0]");
    assertExists("trak[0] resolves", trak0.boxBytes);

    // trak[1] exists
    const trak1 = resolveByPathToBoxAndContainingTrack(mp4, "moov/trak[1]");
    assertExists("trak[1] resolves", trak1.boxBytes);

    // trak[2] does not exist
    const trak2 = resolveByPathToBoxAndContainingTrack(mp4, "moov/trak[2]");
    assertNotExists( "trak[2] resolves", trak2.boxBytes);

}

// Returns containingTrack when resolving a path under moov/trak[n].
// Tracks are enumerated by the caller.
// The resolver never represents “all tracks”.
export async function testReturnsContainingTrackForTrakScopedPath() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    const result =
        resolveByPathToBoxAndContainingTrack(
            mp4Bytes,
            "moov/trak[0]/mdia"
        );

    assertExists("boxBytes", result.boxBytes);
    assertExists("containingTrack", result.containingTrack);

    assertEqual(
        "containingTrack is Uint8Array",
        result.containingTrack instanceof Uint8Array,
        true
    );

    assertEqual(
        "containingTrack is not mdia box",
        result.containingTrack !== result.boxBytes,
        true
    );

    assertEqual(
        "registryPath is canonical",
        result.registryPath,
        "moov/trak/mdia"
    );
}

// ---------------------------------------------------------
// Normal ISO traversal
// ---------------------------------------------------------

// Resolves a valid ISO child path under a trak container.
export async function testResolvesNormalIsoChildPath() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    const result =
        resolveByPathToBoxAndContainingTrack(
            mp4Bytes,
            "moov/trak[0]/mdia"
        );

    assertExists("boxBytes", result.boxBytes);
    assertEqual(
        "boxBytes is Uint8Array",
        result.boxBytes instanceof Uint8Array,
        true
    );

    assertEqual(
        "registryPath is canonical",
        result.registryPath,
        "moov/trak/mdia"
    );

    assertExists("containingTrack", result.containingTrack);
    assertEqual(
        "containingTrack is Uint8Array",
        result.containingTrack instanceof Uint8Array,
        true
    );
}

// Returns an explicit absent result when an optional ISO child does not exist.
export async function testOptionalIsoChildAbsentReturnsExplicitAbsentResult() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    const result =
        resolveByPathToBoxAndContainingTrack(
            mp4Bytes,
            "moov/trak[0]/mdia/minf/stbl/ctts"
        );

    assertEqual(
        "result.exists is false",
        result.exists,
        false
    );

    assertEqual(
        "boxBytes is null for absent optional box",
        result.boxBytes,
        null
    );

    assertExists(
        "containingTrack is still provided as context",
        result.containingTrack
    );

    assertEqual(
        "registryPath still returned",
        result.registryPath,
        "moov/trak/mdia/minf/stbl/ctts"
    );
}

// ---------------------------------------------------------
// MINF divergence enforcement
// ---------------------------------------------------------

// Rejects vmhd traversal on a soun handler track.
export async function testRejectsVmhdOnAudioTrack() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    // Audio track attempting to traverse into vmhd must fail
    assertThrows(
        "vmhd is rejected on soun track",
        () => {
            resolveByPathToBoxAndContainingTrack(
                mp4Bytes,
                "moov/trak[1]/mdia/minf/vmhd"
            );
        },
        (err) =>
            err.message.includes("Audio track") ||
            err.message.includes("vmhd")
    );
}

// Rejects smhd traversal on a vide handler track.
export async function testRejectsSmhdOnVideoTrack() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    // Video track attempting to traverse into smhd must fail
    assertThrows(
        "smhd is rejected on vide track",
        () => {
            resolveByPathToBoxAndContainingTrack(
                mp4Bytes,
                "moov/trak[0]/mdia/minf/smhd"
            );
        },
        (err) =>
            err.message.includes("Video track") ||
            err.message.includes("smhd")
    );
}


// ---------------------------------------------------------
// STSD / SampleEntry grammar
// ---------------------------------------------------------

// Rejects stsd/sample without an explicit index.
export async function testRejectsBareStsdSampleSelector() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    assertThrows(
        "bare stsd/sample is rejected",
        () => {
            resolveByPathToBoxAndContainingTrack(
                mp4Bytes,
                "moov/trak[0]/mdia/minf/stbl/stsd/sample"
            );
        },
        (err) =>
            err.message.includes("SampleEntries must be indexed") ||
            err.message.includes("sample[n]")
    );
}

// Rewrites stsd/sample[n] to stsd|<codec> registry path.
export async function testResolvesStsdSampleIndexToConcreteCodec() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    const result =
        resolveByPathToBoxAndContainingTrack(
            mp4Bytes,
            "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]"
        );

    assertEqual(
        "sample[n] rewrites to concrete codec registry path",
        result.registryPath,
        "moov/trak/mdia/minf/stbl/stsd|avc1"
    );
}

// Resolves stsd/sample[n] with no child to SampleEntry bytes.
export async function testTerminalSampleEntryReturnsSampleEntryBytes() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    const result =
        resolveByPathToBoxAndContainingTrack(
            mp4Bytes,
            "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]"
        );

    assertExists(
        "SampleEntry bytes returned",
        result.boxBytes
    );

    assertEqual(
        "SampleEntry bytes are Uint8Array",
        true,
        result.boxBytes instanceof Uint8Array
    );
}


// ---------------------------------------------------------
// SampleEntry child traversal
// ---------------------------------------------------------

// Resolves a valid SampleEntry child box such as avcC.
export async function testResolvesValidSampleEntryChild() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    const result =
        resolveByPathToBoxAndContainingTrack(
            mp4Bytes,
            "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]/avcC"
        );

    assertEqual(
        "registryPath rewritten to codec-qualified child",
        result.registryPath,
        "moov/trak/mdia/minf/stbl/stsd|avc1/avcC"
    );

    assertEqual(
        "child box bytes returned",
        true, 
        result.boxBytes instanceof Uint8Array
    );
}

// Rejects traversal to a child not valid for the SampleEntry codec.
export async function testRejectsInvalidSampleEntryChild() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    assertThrows(
        "invalid SampleEntry child is rejected",
        () => {
            resolveByPathToBoxAndContainingTrack(
                mp4Bytes,
                "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]/nope"
            );
        },
        (err) =>
            err.message.includes("does not contain child")
    );
}

// Rejects esds under avc1 SampleEntry.
export async function testRejectsAvc1EsdsCombination() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    assertThrows(
        "avc1/esds is rejected",
        () => {
            resolveByPathToBoxAndContainingTrack(
                mp4Bytes,
                "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]/esds"
            );
        },
        (err) =>
            err.message.includes("avc1") &&
            err.message.includes("esds")
    );
}

// Rejects avcC under mp4a SampleEntry.
export async function testRejectsMp4aAvcCCombination() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    assertThrows(
        "mp4a/avcC is rejected",
        () => {
            resolveByPathToBoxAndContainingTrack(
                mp4Bytes,
                "moov/trak[1]/mdia/minf/stbl/stsd/sample[0]/avcC"
            );
        },
        (err) =>
            err.message.includes("mp4a") &&
            err.message.includes("avcC")
    );
}

// ---------------------------------------------------------
// Registry path invariants
// ---------------------------------------------------------

// Never return moov/trak for paths below trak
export async function testNeverReturnsTrakRegistryPathForDescendants() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    // These SHOULD resolve to moov/trak
    const trakPaths = [
        "moov/trak[0]",
        "moov/trak[1]"
    ];

    for (const path of trakPaths) {
        const result = resolveByPathToBoxAndContainingTrack(mp4Bytes, path);
        assertEqual(
            `registryPath for ${path} is moov/trak`,
            result.registryPath,
            "moov/trak"
        );
    }

    // These MUST NOT resolve to moov/trak
    const descendantPaths = [
        "moov/trak[0]/mdia",
        "moov/trak[0]/mdia/minf",
        "moov/trak[0]/mdia/minf/stbl/stsd",
        "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]"
    ];

    for (const path of descendantPaths) {
        const result = resolveByPathToBoxAndContainingTrack(mp4Bytes, path);

        assertEqual(
            `registryPath for ${path} is not moov/trak`,
            result.registryPath !== "moov/trak",
            true
        );
    }
}

// Ensures registryPath never includes sample[n] grammar.
export async function testRegistryPathNeverContainsSampleGrammar() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    const result =
        resolveByPathToBoxAndContainingTrack(
            mp4Bytes,
            "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]/avcC"
        );

    assertEqual(
        "registryPath does not contain sample[n]",
        false,
        result.registryPath.includes("sample[")
    );
}

// Ensures registryPath is stripped of all bracket selectors.
export async function testRegistryPathIsCanonicalStrippedForm() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    const result =
        resolveByPathToBoxAndContainingTrack(
            mp4Bytes,
            "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]"
        );

    assertEqual(
        "registryPath is canonical and bracket-free",
        result.registryPath,
        "moov/trak/mdia/minf/stbl/stsd|avc1"
    );
}

// ---------------------------------------------------------
// Error surface / messaging
// ---------------------------------------------------------

// Error message mentions that tracks must be indexed with trak[n].
export async function testErrorMentionsIndexedTrakRequirement() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    let error;
    try {
        resolveByPathToBoxAndContainingTrack(mp4Bytes, "moov/trak");
    } catch (e) {
        error = e;
    }

    assertExists(
        "error thrown for bare moov/trak",
        error
    );

    assertEqual(
        "error mentions indexed trak requirement",
        true, 
        error.message.includes("trak[n]") ||
        error.message.includes("indexed")
    );
}

// Error message includes the offending traversal path.
export async function testErrorMentionsOffendingPath() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    const offendingPath = "moov/trak";

    let error;
    try {
        resolveByPathToBoxAndContainingTrack(mp4Bytes, offendingPath);
    } catch (e) {
        error = e;
    }

    assertExists(
        "error thrown for offending path",
        error
    );

    assertEqual(
        "error message includes offending path",
        true,
        error.message.includes(offendingPath)
    );
}

// ---------------------------------------------------------
// RegistryPath / registryKey correctness
// ---------------------------------------------------------

// Resolving stsd returns registryPath "moov/trak/mdia/minf/stbl/stsd".
export async function testRegistryPathSetForBareStsd() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    const result =
        resolveByPathToBoxAndContainingTrack(
            mp4Bytes,
            "moov/trak[0]/mdia/minf/stbl/stsd"
        );

    assertExists(
        "result returned",
        result
    );

    assertEqual(
        "registryPath for bare stsd",
        result.registryPath,
        "moov/trak/mdia/minf/stbl/stsd"
    );
}

// Resolving stsd/sample[n] returns concrete codec registryPath.
export async function testRegistryPathSetForSampleEntryTerminal() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    const result =
        resolveByPathToBoxAndContainingTrack(
            mp4Bytes,
            "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]"
        );

    assertExists(
        "result returned",
        result
    );

    assertEqual(
        "registryPath rewritten to concrete codec",
        true,
        result.registryPath.includes("stsd|")
    );

    assertEqual(
        "registryPath does not contain sample grammar",
        true,
        !result.registryPath.includes("sample[")
    );
}

// Resolving stsd/sample[n]/child returns codec-qualified registryPath.
export async function testRegistryPathSetForSampleEntryChild() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    const result =
        resolveByPathToBoxAndContainingTrack(
            mp4Bytes,
            "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]/avcC"
        );

    assertExists(
        "result returned",
        result
    );

    assertEqual(
        "registryPath for SampleEntry child",
        result.registryPath,
        "moov/trak/mdia/minf/stbl/stsd|avc1/avcC"
    );
}

// Any successful resolution returns a defined registryPath.
export async function testRegistryPathNeverUndefinedOnSuccess() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    const paths = [
        "moov/trak[0]",
        "moov/trak[0]/mdia/minf/stbl/stsd",
        "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]",
        "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]/avcC"
    ];

    for (const path of paths) {

        const result =
            resolveByPathToBoxAndContainingTrack(mp4Bytes, path);

        assertExists(
            `registryPath defined for ${path}`,
            result.registryPath
        );
    }
}

// ---------------------------------------------------------
// Remaining-path edge cases
// ---------------------------------------------------------

// Path ending in moov/trak[n]/ does not synthesize an invalid registryPath.
export async function testTrailingSlashAfterTrakIndexIsHandled() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    const result = resolveByPathToBoxAndContainingTrack(
            mp4Bytes,
            "moov/trak[0]/mdia/"
        );

    assertExists(
        "result returned",
        result
    );

    assertEqual(
        "registryPath normalized despite trailing slash",
        result.registryPath,
        "moov/trak/mdia"
    );
}


// ---------------------------------------------------------
// resolveOptionalSingleIsoChild integration
// ---------------------------------------------------------



// Optional ISO child absence does not throw when allowed.
export async function testOptionalIsoChildUndefinedDoesNotThrow() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    let threw = false;
    let result;

    try {
        // Choose a path where the final child is optional and absent
        result =
            resolveByPathToBoxAndContainingTrack(
                mp4Bytes,
                "moov/trak[0]/mdia/minf/stbl/doesNotExist"
            );
    } catch (e) {
        threw = true;
    }

    assertEqual(
        "optional ISO child absence does not throw",
        threw,
        false
    );

    assertExists(
        "resolution result returned",
        result
    );
}


// ---------------------------------------------------------
// Containing track invariants
// ---------------------------------------------------------

// When present, containingTrack is always a Uint8Array.
export async function testContainingTrackAlwaysUint8ArrayWhenPresent() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    const result =
        resolveByPathToBoxAndContainingTrack(
            mp4Bytes,
            "moov/trak[0]/mdia"
        );

    assertExists(
        "containingTrack is present",
        result.containingTrack
    );

    assertEqual(
        "containingTrack is a Uint8Array",
        result.containingTrack instanceof Uint8Array,
        true
    );
}

// Resolving multiple paths does not mutate containingTrack bytes.
export async function testContainingTrackNotMutatedAcrossResolutions() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await resp.arrayBuffer());

    const first =
        resolveByPathToBoxAndContainingTrack(
            mp4Bytes,
            "moov/trak[0]/mdia"
        );

    const snapshot =
        new Uint8Array(first.containingTrack);

    const second =
        resolveByPathToBoxAndContainingTrack(
            mp4Bytes,
            "moov/trak[0]/mdia/minf"
        );

    assertEqual(
        "containingTrack byte length unchanged",
        second.containingTrack.length,
        snapshot.length
    );

    for (let i = 0; i < snapshot.length; i++) {
        if (second.containingTrack[i] !== snapshot[i]) {
            throw new Error(
                `containingTrack mutated at byte ${i}`
            );
        }
    }
}

export async function testRootMoovTrailingSlashIsNormalized() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const result = resolveByPathToBoxAndContainingTrack(mp4, "moov/");

    assertExists("result returned", result);
    assertEqual("registryPath normalized", result.registryPath, "moov");
    console.log(result.boxBytes, 'result.boxBytes');
    assertEqual("boxBytes is Uint8Array", true, result.boxBytes instanceof Uint8Array);
}

export async function testTrailingSlashAfterIndexedTrakResolvesToTrak() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const result =
        resolveByPathToBoxAndContainingTrack(mp4, "moov/trak[0]/");

    assertExists("result returned", result);
    assertEqual("registryPath is NOT moov/trak", result.registryPath !== "moov/trak", true);
    assertEqual("boxBytes is Uint8Array", true, result.boxBytes instanceof Uint8Array);
}

export async function testRejectsTraversalPastSampleEntryChild() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    assertThrows(
        "cannot traverse past avcC",
        () => {
            resolveByPathToBoxAndContainingTrack(
                mp4,
                "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]/avcC/extra"
            );
        },
        err => err.message.includes("avcC")
    );
}
export async function testRejectsIllegalStsdShortcut() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    assertThrows(
        "direct traversal to stsd is rejected",
        () => {
            resolveByPathToBoxAndContainingTrack(
                mp4,
                "moov/trak[0]/stsd"
            );
        },
        err => err.message.includes("stsd")
    );
}

export async function testOptionalIsoChildAbsenceDoesNotMutateRegistryPath() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const result =
        resolveByPathToBoxAndContainingTrack(
            mp4,
            "moov/trak[0]/mdia/minf/stbl/doesNotExist"
        );

    assertEqual(
        "registryPath still correct",
        result.registryPath,
        "moov/trak/mdia/minf/stbl/doesNotExist"
    );
}

export async function testRegistryPathIsNeverEmpty() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const paths = [
        "moov",
        "moov/trak[0]",
        "moov/trak[0]/mdia",
        "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]"
    ];

    for (const path of paths) {
        const result = resolveByPathToBoxAndContainingTrack(mp4, path);
        assertEqual(
            `registryPath not empty for ${path}`,
            true,
            typeof result.registryPath === "string" &&
            result.registryPath.length > 0
        );
    }
}

export async function testRejectsTraversalPastTerminalBox() {
    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    assertThrows(
        "cannot traverse past vmhd",
        () => {
            resolveByPathToBoxAndContainingTrack(
                mp4,
                "moov/trak[0]/mdia/minf/vmhd/extra"
            );
        }
    );
}

export async function testResolvesRootLevelLeafBox() {
    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const result =
        resolveByPathToBoxAndContainingTrack(mp4, "ftyp");

    assertEqual("registryPath is ftyp", result.registryPath, "ftyp");
    assertEqual("boxBytes is Uint8Array", true, result.boxBytes instanceof Uint8Array);
    assertEqual("containingTrack is null", result.containingTrack, null);
}

export async function testRejectsSkippingStructuralLevels() {
    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    assertThrows(
        "cannot skip mdia/minf",
        () => {
            resolveByPathToBoxAndContainingTrack(
                mp4,
                "moov/trak[0]/stbl"
            );
        }
    );
}
export async function testAbsoluteAndRelativeTraversalParity() {
    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const abs =
        resolveByPathToBoxAndContainingTrack(
            mp4,
            "moov/trak[0]/mdia/minf"
        );

    const rel =
        resolveByPathToBoxAndContainingTrack(
            abs.containingTrack,
            "mdia/minf"
        );

    assertEqual("registryPath parity", abs.registryPath, rel.registryPath);
}
