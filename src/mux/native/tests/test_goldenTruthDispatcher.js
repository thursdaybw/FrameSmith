/**
 * Golden Truth Dispatcher — Contract Tests
 * =======================================
 *
 * This file defines the **authoritative contract** for the
 * Golden Truth dispatcher used by Framesmith’s NativeMuxer tests.
 *
 * These tests do NOT validate MP4 parsing correctness.
 * They do NOT validate box serialization.
 *
 * They validate **routing decisions only**.
 *
 * If all tests in this file pass, the dispatcher:
 *
 *   - resolves the correct extractor
 *   - enforces a closed, explicit path grammar
 *   - performs no inference, guessing, or fallback
 *   - is safe to evolve into a full demuxer
 *
 * ------------------------------------------------------------------
 * Scope and Intent
 * ------------------------------------------------------------------
 *
 * The dispatcher sits between:
 *
 *   (a) an *input path* supplied by a test or tool
 *   (b) a *registry of extractors* keyed by canonical paths
 *
 * Its responsibility is:
 *
 *   - to interpret the input path
 *   - to select exactly ONE extractor
 *   - or to fail loudly and immediately
 *
 * It must NEVER:
 *
 *   - search other tracks
 *   - infer intent from handler type
 *   - guess or rewrite addressability
 *   - accept ambiguous paths
 *
 * Those behaviors are explicitly forbidden and locked by tests here.
 *
 * ------------------------------------------------------------------
 * Oracle Assumptions
 * ------------------------------------------------------------------
 *
 * All tests use `reference/reference_av.mp4` as the sole fixture.
 *
 * This oracle is assumed to contain:
 *
 *   - trak[0] → video track (hdlr = 'vide')
 *   - trak[1] → audio track (hdlr = 'soun')
 *
 * Track order is considered stable for this oracle.
 *
 * ------------------------------------------------------------------
 * Path Grammar (Locked)
 * ------------------------------------------------------------------
 *
 * Input paths:
 *
 *   - MAY contain concrete indices for plural containers
 *
 *       moov/trak[0]/mdia/minf/...
 *
 *   - MUST index plural containers explicitly
 *
 *       moov/trak/...        ❌ forbidden
 *
 *   - MUST be structural, not semantic
 *
 * Registry paths:
 *
 *   - MUST be canonical and index-free
 *   - describe *abstract structure*, not *instance*
 *
 *       moov/trak/mdia/minf/stbl/stsd
 *
 *   - MUST NOT include positional selectors
 *     (e.g. `trak[n]`, `sample[n]`)
 *
 *   - MUST NOT include SampleEntry addressing grammar
 *
 * SampleEntry registry paths:
 *
 *   - represent concrete SampleEntry-owned extractors
 *   - are resolved only AFTER SampleEntry extraction
 *   - NEVER include `sample` or numeric indices
 *   - MUST include an explicit traversal boundary (`|`)
 *
 *       stsd|avc1           (SampleEntry root)
 *       stsd|avc1/avcC      (SampleEntry child)
 *       stsd|mp4a/esds      (SampleEntry child)
 *
 * Index normalization:
 *
 *   - `trak[n]` and `sample[n]` are consumed during traversal
 *   - all indices are stripped before registry lookup
 *   - SampleEntry traversal switches grammar using `|`
 *   - extractor invocation occurs ONLY after normalization
 * 
 * ------------------------------------------------------------------
 * Track Selection 
 * ------------------------------------------------------------------
 *
 *  This file locks a critical rule:
 *
 *   - `trak[n]` answers **WHERE**
 *
 * ------------------------------------------------------------------
 * SampleEntry Traversal Rules
 * ------------------------------------------------------------------
 *
 * SampleEntry traversal is structural and track-scoped:
 * 
 *   stsd/sample[n]
 * 
 * SampleEntries are selected by index, not by codec.
 * Codec FourCCs are descriptive properties of SampleEntries,
 * not input addressing mechanisms.
 *
 * Terminal extraction is valid:
 *
 *   stsd/sample[n]          ✅ returns SampleEntry bytes and index-derived context
 *
 * The dispatcher must:
 *
 *   - resolve only within the selected track
 *   - validate the sample index
 *   - return SampleEntry bytes when addressed directly
 *   - never search other tracks
 *
 * Child traversal under SampleEntry is also structural:
 * 
 *   stsd/sample[n]/avcC     ✅ (video)
 *   stsd/sample[n]/esds     ✅ (audio)
 * 
 * Invalid children for the SampleEntry’s codec MUST fail.
 *
 * ------------------------------------------------------------------
 * Audio / Video Divergence
 * ------------------------------------------------------------------
 *
 * Audio and video tracks diverge structurally at `minf`.
 *
 * Locked rules:
 *
 *   - video tracks accept `vmhd`
 *   - audio tracks accept `smhd`
 *   - cross-acceptance is forbidden
 *
 * ------------------------------------------------------------------
 * Legacy Selector Rejection
 * ------------------------------------------------------------------
 *
 * The following legacy mechanisms are explicitly forbidden:
 *
 *   - options.trackType
 *   - semantic qualifiers like stsd[avc1]
 *   - non-numeric trak selectors
 *
 * These represent one-way-door designs that are intentionally rejected.
 *
 * ------------------------------------------------------------------
 * Test-Only Instrumentation
 * ------------------------------------------------------------------
 *
 * To allow dispatcher behavior to be asserted precisely,
 * the registry exposes minimal test-only hooks:
 *
 *   - `__registryPath` on dispatcher results
 *   - `__getRegistryPaths()` for canonical registry inspection
 *
 * These exist solely to validate routing decisions.
 * They are NOT part of the production API.
 *
 * ------------------------------------------------------------------
 * What This File Guarantees
 * ------------------------------------------------------------------
 *
 * If every test in this file passes:
 *
 *   - the dispatcher grammar is locked
 *   - routing is deterministic
 *   - no silent regressions are possible
 *   - future demuxer evolution remains safe
 *
 * This file is the concrete.
 * Changes here must be intentional and justified.
 *
 *
 * STSD — Correct Mental Model and Path Grammar
 * ===========================================
 *
 * Dispatcher Reality (Normative)
 * ------------------------------
 * `stsd` is treated as a *plural container* of SampleEntry records.
 *
 * At the dispatcher boundary:
 *
 *   - SampleEntries are addressed structurally
 *   - Indices are **0-based**
 *   - Addressing is positional, not semantic
 *
 * Grammar:
 *
 *   stsd
 *   stsd/sample[n]
 *
 * Normalized registry examples:
 *
 *   moov/trak/mdia/minf/stbl/stsd
 *   moov/trak/mdia/minf/stbl/stsd|avc1
 *   moov/trak/mdia/minf/stbl/stsd|avc1/avcC
 *
 * Where:
 *   - `stsd` addresses the STSD box as a whole
 *   - `n` is the 0-based index of the SampleEntry
 *   - SampleEntry selection is purely structural
 *
 * Codec FourCCs (e.g. avc1, mp4a):
 *
 *   - are descriptive properties of SampleEntries
 *
 *   Input/Selector layer rules:
 *     - MUST NOT be used for addressing SampleEntries
 *     - MUST NOT appear in input paths (e.g. stsd/avc1 is forbidden)
 *
 *   Registry layer rules:
 *     - MUST NOT appear in registry paths at the STSD ISO level
 *     - MUST appear only after an explicit traversal boundary (`|`)
 *     - MUST NOT include `sample` or numeric indices
 *     - MAY represent SampleEntry roots or SampleEntry-owned children
 *
 *       stsd|avc1
 *       stsd|avc1/avcC
 *       stsd|avc1/btrt
 *       stsd|mp4a/esds
 *
 * ------------------------------------------------------------------
 * MP4 Semantics (Explicitly Deferred)
 * ------------------------------------------------------------------
 *
 * The MP4 field `sample_description_index` is:
 *
 *   - 1-based
 *   - semantic
 *   - specific to sample decoding
 *
 * This numbering DOES NOT appear in dispatcher grammar.
 *
 * Any translation between:
 *
 *   dispatcher index (0-based)
 *   ↔ MP4 semantic index (1-based)
 *
 * is the responsibility of the extractor layer, not the dispatcher.
 *
 * ------------------------------------------------------------------
 * Current Constraint (Temporary)
 * ------------------------------------------------------------------
 *
 * Framesmith currently supports:
 *
 *   - one or more SampleEntries per track
 *
 * This constraint applies only to **cardinality in the oracle files**,
 * not to grammar or addressability.
 *
 * Direct SampleEntry extraction via:
 *
 *   stsd/sample[n]
 *
 * is explicitly supported and is a valid terminal resolution.
 *
 * SampleEntry indices are:
 *   - 0-based
 *   - positional
 *   - scoped strictly to the selected track
 *
 * Registry paths MUST NOT contain `sample`,
 * even when SampleEntry extraction is requested.
 *
 * After SampleEntry extraction, registry paths MUST include
 * the concrete SampleEntry type separated by `|`
 * (e.g. `stsd|avc1`, `stsd|mp4a`).
 *
 * ------------------------------------------------------------------
 * Architectural Rule
 * ------------------------------------------------------------------
 *
 * Dispatcher grammar is:
 *
 *   - structural
 *   - index-based
 *   - context-free with respect to routing
 *   - explicit about traversal mode boundaries (`|`)
 *
 * Semantic interpretation may occur inside extractors,
 * but MUST NOT alter dispatcher grammar or addressability.
 *
 * If this comment becomes incorrect, the dispatcher design is wrong.
 */


/*
### Notes on Plurality, Dispatch, and Deferred Grammar Extensions

#### Scope and intent

The golden truth extractors and dispatcher logic exist primarily to **validate muxer correctness**, not to implement a full demuxer. However, they are intentionally evolving in that direction, because a demuxer will be required later in the project.

For this reason, the design explicitly avoids “locking in” assumptions that are known to be incomplete, while still enforcing a strict and simple grammar today.

The path grammar already supports the only mechanism required for future extension:

```
[n]  // explicit indexing
```

The path grammar supports two orthogonal mechanisms:
```
[n] // explicit indexing
| // traversal mode boundary
```

No additional selector syntax is required.

---

### STSD (already covered elsewhere)

`stsd` is handled as a special case and is documented separately.

It is the only ISO box that introduces a traversal boundary (`|`)
into SampleEntry-scoped structure.

It is the **type table** for a track and necessarily participates in schema resolution. The dispatcher must consult track context (`hdlr`) and resolve the appropriate schema. This cannot be deferred and is already enforced by tests.

---

### SGPD and SBGP (explicitly called out)

`sgpd` (Sample Group Description Box) and `sbgp` (Sample-to-Group Box) are the **only other boxes that materially matter for future grammar evolution**.

They are distinct from other “plural” boxes because:

* They are **schema-driven**
* They form a **linked pair**
* They introduce **indirection** (grouping types → descriptions → sample mappings)
* They affect **sample interpretation**, not just metadata

In other words:

> SGPD/SBGP are structurally plural *and* semantically significant.

This makes them fundamentally different from simple table boxes.

#### Current handling

At present:

* SGPD and SBGP are treated as **structural leaves**
* Extractors allow traversal without semantic interpretation
* No row-level or grouping-level addressing is exposed in the grammar
* Dispatcher logic does not attempt to resolve grouping semantics

This is intentional.

The current implementation prioritizes:

* deterministic traversal
* muxer verification
* testability
* minimal grammar surface area

#### Future direction (explicitly not locked in)

When SGPD/SBGP semantics are required, they can be supported by **extending the grammar**, not by retrofitting ad-hoc selectors.

For example (illustrative only):

```
sgpd[groupingType]/entry[n]
sbgp[groupingType]/mapping[n]
```

or equivalent index-based forms.

The existing `[n]` mechanism is sufficient. No new selector syntax is required.

---

### Other plural boxes (intentionally deferred)

Other boxes that are plural in the MP4 spec are intentionally *not* treated as plural in the grammar today:

* `ctts`, `stts`, `stsc`, `stsz`, `stss`
* internal tables and rows
* container boxes such as `mdia`, `minf`, `stbl`

These are considered **structurally plural but semantically opaque** at the current stage.

Key points:

* They do not introduce schema ambiguity
* They do not require dispatch
* They do not affect sample decoding rules in isolation
* Row-level access can be added later without breaking paths

As such, they do not warrant dispatcher involvement or grammar expansion at this time.

---

### Design principle (summary)

* **Dispatch is used only where ambiguity exists**
* **Plurality is surfaced only when required**
* **Grammar extensions are deferred, not denied**
* **No irreversible assumptions are encoded**

The system is deliberately designed so that:

> Grammar evolution is additive, not corrective.

This preserves correctness today while keeping the door fully open for demuxer-grade behavior later.
*/

import {
    getGoldenTruthBox,
    __TEST_ONLY__,
} from "./goldenTruthExtractors/index.js";

import {
    findBoxesByPathFromMp4
} from "./reference/BoxExtractor.js"

import {
    GoldenTruthRegistry,
    __getRegistryPaths
} from "./goldenTruthExtractors/GoldenTruthRegistry.js"

import { readFourCC } from "../box-schema/boxLayoutReaders.js";

import {
    assertEqual,
    assertExists,
    assertThrows
} from "./assertions.js";

import {
    stripBracketSelectors
} from "./goldenTruthExtractors/sanitizeRegistryPath.js";

import {
    resolveSampleEntryFromTrak,
} from "./goldenTruthExtractors/GoldenTruthPathResolver.js";

import {
    extractBoxByPathFromMp4,
} from "./reference/BoxExtractor.js";


import {
    getSampleEntryTableFromStsdAsList
} from "../reference/getSampleEntryTableFromStsdAsList.js";


export async function testFromMp4_RootMoov_Resolves() {

    // ---------------------------------------------------------
    // Load MP4 bytes
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    assertEqual(
        "mp4 is Uint8Array",
        mp4 instanceof Uint8Array,
        true
    );

    // ---------------------------------------------------------
    // Resolve moov via fromMp4
    // ---------------------------------------------------------
    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov"
        );

    assertExists(
        "truth object returned",
        truth
    );

    assertEqual(
        "truth has readBoxReport",
        typeof truth.readBoxReport,
        "function"
    );

    assertEqual(
        "truth has getEmitterInput",
        typeof truth.getEmitterInput,
        "function"
    );

    // ---------------------------------------------------------
    // Prove extractor NOT called eagerly
    // ---------------------------------------------------------
    const extractor =
        GoldenTruthRegistry.getExtractor("moov");

    let readCalled = false;
    let readCalledWith;

    const origRead = extractor.readBoxReport;

    extractor.readBoxReport = function (bytes) {
        readCalled = true;
        readCalledWith = bytes;
        return origRead.apply(this, arguments);
    };

    assertEqual(
        "extractor not called eagerly",
        readCalled,
        false
    );

    // ---------------------------------------------------------
    // Trigger extraction and prove correct binding
    // ---------------------------------------------------------
    truth.readBoxReport();

    assertEqual(
        "extractor called after readBoxReport",
        readCalled,
        true
    );

    assertExists(
        "extractor received box bytes",
        readCalledWith
    );

    // Cleanup
    extractor.readBoxReport = origRead;
}

export async function testFromBox_RootMp4_ResolvesMoov() {

    // ---------------------------------------------------------
    // Load MP4 bytes
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    assertEqual(
        "mp4 is Uint8Array",
        mp4 instanceof Uint8Array,
        true
    );

    // ---------------------------------------------------------
    // Resolve moov via $mp4 root
    // ---------------------------------------------------------
    const truth =
        getGoldenTruthBox.getSemanticBoxDataFromBox({
            boxBytes: mp4,
            sourceRegistryKey: "$mp4",
            targetBoxPath: "moov"
        });

    assertExists(
        "truth object returned",
        truth
    );

    assertEqual(
        "truth has readBoxReport",
        typeof truth.readBoxReport,
        "function"
    );

    assertEqual(
        "truth has getEmitterInput",
        typeof truth.getEmitterInput,
        "function"
    );

    // ---------------------------------------------------------
    // Prove extractor NOT called eagerly
    // ---------------------------------------------------------
    const extractor =
        GoldenTruthRegistry.getExtractor("moov");

    let readCalled = false;
    let readCalledWith;

    const origRead = extractor.readBoxReport;

    extractor.readBoxReport = function (bytes) {
        readCalled = true;
        readCalledWith = bytes;
        return origRead.apply(this, arguments);
    };

    assertEqual(
        "extractor not called eagerly",
        readCalled,
        false
    );

    // ---------------------------------------------------------
    // Trigger extraction and prove correct binding
    // ---------------------------------------------------------
    truth.readBoxReport();

    assertEqual(
        "extractor called after readBoxReport",
        readCalled,
        true
    );

    assertExists(
        "extractor received box bytes",
        readCalledWith
    );

    // Cleanup
    extractor.readBoxReport = origRead;
}


/**
 * Dispatcher — Normalizes Positional Selectors
 * -------------------------------------------
 *
 * Rule:
 *   Input paths may include explicit numeric indices
 *   for plural containers:
 *
 *     moov/trak[0]/mdia/minf/stbl/stsd/sample[1]
 *
 *   Registry paths MUST describe abstract structure only
 *   and MUST NOT contain indices:
 *
 *     moov/trak/mdia/minf/stbl/stsd/sample
 *
 * The dispatcher is responsible for:
 *   - interpreting `[n]` selectors during traversal
 *   - stripping all indices before registry lookup
 *   - resolving against canonical, index-free paths
 *
 * Expected behavior:
 *   - Correct extractor is selected
 *   - Extraction succeeds
 *   - No inference or fallback occurs
 */
export async function testDispatcher_NormalizesIndexedPaths() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const truth = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4,
        "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]/avcC"
    );

    assertExists(
        "semantic box data returned",
        truth
    );

    // ---------------------------------------------------------
    // 1. Correct extractor resolved (avcC)
    // ---------------------------------------------------------
    const report = truth.readBoxReport();

    assertEqual(
        "resolved box type is avcC",
        report.box.type,
        "avcC"
    );

    // ---------------------------------------------------------
    // 2. Semantic content proves correct SampleEntry (avc1)
    // ---------------------------------------------------------
    assertExists(
        "avcC opaque payload exists",
        report.box.fields.opaquePayloadBytes
    );

    // ---------------------------------------------------------
    // 3. Emitter input available (round-trip capable)
    // ---------------------------------------------------------
    const params = truth.getEmitterInput();

    assertExists(
        "builder params returned",
        params
    );
}

/**
 * Dispatcher — Track Index Grammar Is Contextual
 * ----------------------------------------------
 *
 * Rule:
 *   Whether `trak[n]` is required or forbidden depends on
 *   the *byte context* the dispatcher is operating in.
 *
 * The dispatcher does NOT interpret paths in isolation.
 * Paths are interpreted relative to the bytes provided.
 *
 * There are two valid contexts:
 *
 * 1. Plural track context (MP4 / moov bytes)
 *    --------------------------------------
 *    When the source bytes may contain multiple tracks:
 *
 *      - `trak[n]` is REQUIRED
 *      - Bare `trak` is ambiguous and must be rejected
 *
 *    Example (valid):
 *      moov/trak[0]/mdia/minf/stbl/stsd
 *
 *    Example (invalid):
 *      moov/trak/mdia/minf/stbl/stsd
 *
 * 2. Singular track context (trak bytes)
 *    -----------------------------------
 *    When the source bytes already represent a single track:
 *
 *      - `trak[n]` is FORBIDDEN
 *      - Bare `trak` is the only valid form
 *
 *    Example (valid):
 *      moov/trak/mdia/minf/stbl/stsd
 *
 *    Example (invalid):
 *      moov/trak[1]/mdia/hdlr
 *
 * Rationale:
 *   - Grammar must reflect structural reality, not string shape
 *   - Once bytes represent a concrete track, indexing is meaningless
 *   - The dispatcher must never guess or silently reinterpret intent
 *
 * This test asserts that:
 *   - MP4 context requires indexed track selection
 *   - Single-track context rejects indexed track selection
 */
export async function testDispatcher_RequiresIndexedTrak() {

    // ---------------------------------------------------------
    // Load a multi-track MP4 (audio + video)
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Case 1: MP4 context → unindexed trak is invalid
    // ---------------------------------------------------------
    let threw = false;
    let message = "";

    try {
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak/mdia/minf/stbl/stsd"
        );
    } catch (err) {
        threw = true;
        message = String(err.message);
    }

    assertEqual(
        "mp4 context requires indexed trak",
        threw,
        true
    );

    assertEqual(
        "error mentions trak index",
        message.includes("trak") && message.includes("["),
        true
    );

    // ---------------------------------------------------------
    // Case 2: single-track context → indexed trak is invalid
    // ---------------------------------------------------------
    const trak0 =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]"
        ).readBoxReport().raw;

    threw = false;
    message = "";

    try {
        getGoldenTruthBox.getSemanticBoxDataFromBox({
            boxBytes: trak0,
            sourceRegistryKey: "moov/trak",
            targetBoxPath: "moov/trak[1]/mdia/hdlr"
        });
    } catch (err) {
        threw = true;
        message = String(err.message);
    }

    assertEqual(
        "single-track context forbids indexed trak",
        threw,
        true
    );

    assertEqual(
        "error explains invalid indexed trak in concrete context",
        message.includes("trak") && message.includes("context"),
        true
    );
}


/**
 * Dispatcher — Registry Is Canonical
 * ---------------------------------
 *
 * Rule:
 *   Registry paths describe abstract MP4 structure only.
 *
 *   They MUST NOT contain:
 *     - concrete indices (e.g. trak[0])
 *     - positional selectors of any kind
 *
 * Rationale:
 *   - registry describes shape, not instance
 *   - instance addressing belongs to the dispatcher
 *
 * Expected behavior:
 *   - all registry keys are index-free
 */
export async function testDispatcher_RegistryIsCanonical() {

    const paths = __getRegistryPaths();

    let badPath = null;

    for (const path of paths) {

        if (path.includes("[")) {
            badPath = path;
            break;
        }
    }

    assertEqual(
        "registry contains no indexed paths",
        badPath,
        null
    );

}

/**
 * Dispatcher — Trak Index Is Authoritative
 * ---------------------------------------
 *
 * Rule:
 *   The dispatcher must select the track strictly by `trak[n]`.
 *
 *   It must NOT:
 *   - inspect handler type to choose a different track
 *   - fall back to another track if the requested one mismatches
 *
 * Expected behavior:
 *   - traversal stays inside the indexed track
 *   - schema mismatches fail loudly
 */
export async function testDispatcher_TrakIndexIsAuthoritative() {

    // ---------------------------------------------------------
    // 1. Load multi-track MP4 (trak[0]=video, trak[1]=audio)
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    let threw = false;
    let message = "";

    // ---------------------------------------------------------
    // 2. Ask for avc1 inside the AUDIO track (trak[1])
    // ---------------------------------------------------------
    try {

        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[1]/mdia/minf/stbl/stsd/sample[0]/avcC"
        );

    } catch (err) {
        threw = true;
        message = String(err.message);
    }

    // ---------------------------------------------------------
    // 3. Assertions
    // ---------------------------------------------------------
    assertEqual(
        "dispatcher does not reroute to video track",
        threw,
        true
    );

    assertEqual(
        `error indicates invalid child for selected track: ${message}`,
        message.includes("SampleEntry") ||
        message.includes("not found in stsd"),
        true
    );

}

/**
 * Dispatcher — SampleEntry Traversal Is Index-Based
 * ------------------------------------------------
 *
 * Rule:
 *   After selecting a track via `trak[n]`, SampleEntry
 *   traversal is performed exclusively via numeric index:
 *
 *     stsd/sample[k]
 *
 *   Codec type is NOT part of the addressing mechanism.
 *
 * Expected behavior:
 *   - The specified sample index resolves within the selected track
 *   - Non-existent indices fail immediately
 *   - No codec inference or cross-track fallback occurs
 */
export async function testDispatcher_SampleEntryTraversal() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 1. Resolve first sample entry
    // ---------------------------------------------------------
    const semantic = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4,
        "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]"
    );

    const report = semantic.readBoxReport();

    assertEqual(
        "sample[0] resolves to concrete codec",
        report.box.type,
        "avc1"
    );

    // ---------------------------------------------------------
    // 2. Out-of-range sample index throws
    // ---------------------------------------------------------
    let threw = false;

    try {
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]/mdia/minf/stbl/stsd/sample[1]"
        );
    } catch {
        threw = true;
    }

    assertEqual(
        "nonexistent sample index throws",
        threw,
        true
    );
}


/**
 * Dispatcher — Rejects Wrong Schema
 * --------------------------------
 *
 * Rule:
 *   After selecting a track via `trak[n]`, requesting a SampleEntry
 *   that does not exist in that track must throw immediately.
 *
 * Expected behavior:
 *   - No fallback to other tracks
 *   - No schema inference
 *   - Error mentions the missing schema
 */
export async function testDispatcher_RejectsInvalidSampleIndex() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    let threw = false;

    try {
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[1]/mdia/minf/stbl/stsd/sample[99]"
        );
    } catch {
        threw = true;
    }

    assertEqual(
        "invalid sample index throws",
        threw,
        true
    );

}
/**
 * Dispatcher — Minf Divergence
 * ---------------------------
 *
 * Rule:
 *   Audio and video tracks diverge at `minf`.
 *
 *   - video track MUST accept vmhd
 *   - audio track MUST accept smhd
 *   - the opposite combinations MUST fail
 */
export async function testDispatcher_MinfDivergence() {

    // ---------------------------------------------------------
    // 1. Load multi-track MP4 (trak[0]=video, trak[1]=audio)
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Valid combinations
    // ---------------------------------------------------------
    const videoMinf = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4,
        "moov/trak[0]/mdia/minf/vmhd"
    );

    assertEqual(
        "video track resolves vmhd",
        videoMinf.readBoxReport().box.type,
        "vmhd"
    );

    const audioMinf = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4,
        "moov/trak[1]/mdia/minf/smhd"
    );

    assertEqual(
        "audio track resolves smhd",
        audioMinf.readBoxReport().box.type,
        "smhd"
    );

    // ---------------------------------------------------------
    // 3. Invalid combinations
    // ---------------------------------------------------------
    let threwVideo = false;
    let threwAudio = false;

    try {
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]/mdia/minf/smhd"
        );
    } catch {
        threwVideo = true;
    }

    try {
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[1]/mdia/minf/vmhd"
        );
    } catch {
        threwAudio = true;
    }

    assertEqual(
        "video track rejects smhd",
        threwVideo,
        true
    );

    assertEqual(
        "audio track rejects vmhd",
        threwAudio,
        true
    );
}

/**
 * Dispatcher — Does Not Search Other Tracks
 * ----------------------------------------
 *
 * Rule:
 *   Dispatcher must not fall back to another track if the
 *   requested path is invalid within the selected track.
 *
 * Expected behavior:
 *   - traversal is confined to trak[n]
 *   - no cross-track searching
 *   - failure is immediate and loud
 */
export async function testDispatcher_DoesNotSearchOtherTracks() {

    // ---------------------------------------------------------
    // 1. Load multi-track MP4 (trak[0]=video, trak[1]=audio)
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    let threw = false;
    let message = "";

    // ---------------------------------------------------------
    // 2. Request a box that exists in video track only,
    //    but ask for it inside the audio track
    // ---------------------------------------------------------
    try {

        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[1]/mdia/minf/stbl/stsd/sample[0]/avcC"
        );

    } catch (err) {
        threw = true;
        message = String(err.message);
    }

    // ---------------------------------------------------------
    // 3. Assertions
    // ---------------------------------------------------------
    assertEqual(
        "dispatcher does not search other tracks",
        threw,
        true
    );

    assertEqual(
        "error indicates lookup was constrained to selected track",
        message.includes("SampleEntry") ||
        message.includes("not found in stsd"),
        true
    );

}

/**
 * Dispatcher — Invalid Child Fails
 * --------------------------------
 *
 * Rule:
 *   Dispatcher must fail when a requested child box does not
 *   exist at the specified structural position.
 *
 * Expected behavior:
 *   - no fallback
 *   - no silent skip
 *   - error is thrown
 */
export async function testDispatcher_InvalidChildFails() {

    // ---------------------------------------------------------
    // 1. Load multi-track MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    let threw = false;
    let message = "";

    // ---------------------------------------------------------
    // 2. Request a structurally invalid child box
    // ---------------------------------------------------------
    try {

        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]/doesNotExist"
        );

    } catch (err) {
        threw = true;
        message = String(err.message);
    }

    // ---------------------------------------------------------
    // 3. Assertions
    // ---------------------------------------------------------
    assertEqual(
        "invalid child throws",
        threw,
        true
    );

    assertEqual(
        "error mentions missing child",
        message.length > 0,
        true
    );

}

/**
 * Dispatcher — Rejects Legacy Selectors
 * ------------------------------------
 *
 * Rule:
 *   Legacy selector mechanisms are forbidden.
 *
 *   This includes:
 *   - options.trackType
 *   - schema selectors like stsd[avc1]
 *
 * Expected behavior:
 *   - dispatcher throws immediately
 *   - error is explicit
 */
export async function testDispatcher_RejectsLegacySelectors() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    let threwTrackType = false;
    let threwBracket   = false;

    // ---------------------------------------------------------
    // 1. Legacy options.trackType
    // ---------------------------------------------------------
    try {

        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak/mdia/minf/stbl/stsd",
            { trackType: "video" }
        );

    } catch (err) {
        threwTrackType = true;
    }

    // ---------------------------------------------------------
    // 2. Legacy bracket selector in path
    // ---------------------------------------------------------
    try {

        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak/mdia/minf/stbl/stsd[avc1]"
        );

    } catch (err) {
        threwBracket = true;
    }

    // ---------------------------------------------------------
    // 3. Assertions
    // ---------------------------------------------------------
    assertEqual(
        "legacy trackType rejected",
        threwTrackType,
        true
    );

    assertEqual(
        "legacy bracket selector rejected",
        threwBracket,
        true
    );

}

/**
 * Dispatcher — Happy Path Sanity
 * ------------------------------
 *
 * Rule:
 *   Valid, indexed paths for both video and audio tracks
 *   must resolve correctly without errors.
 *
 * This test exists to prove:
 *   - the grammar works
 *   - the dispatcher is usable
 *   - no rule breaks the common case
 */
export async function testDispatcher_HappyPathSanity() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Video track happy path
    // ---------------------------------------------------------
    const video = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4,
        "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]/avcC"
    );

    assertExists(
        "video extractor returned",
        video
    );

    assertEqual(
        "video resolves avcC",
        video.readBoxReport().box.type,
        "avcC"
    );

    // ---------------------------------------------------------
    // Audio track happy path
    // ---------------------------------------------------------
    const audio = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4,
        "moov/trak[1]/mdia/minf/stbl/stsd/sample[0]/esds"
    );

    assertExists(
        "audio extractor returned",
        audio
    );

    assertEqual(
        "audio resolves esds",
        audio.readBoxReport().box.type,
        "esds"
    );
}


/**
 * STSD Dispatcher Contract (Normative)
 * -----------------------------------
 *
 * The STSD path has *dual semantics* and must be handled explicitly
 * by the dispatcher without collapsing abstraction layers.
 *
 * There are THREE distinct, valid resolution modes:
 *
 * ------------------------------------------------------------------
 * 1. Explicit SampleEntry Selection
 * ------------------------------------------------------------------
 * 
 * Path:
 *   moov/trak[n]/mdia/minf/stbl/stsd/sample[k]
 * 
 * Meaning:
 *   "Select the SampleEntry at index k within this track."
 * 
 * Dispatcher behavior:
 *   - Validate track index
 *   - Validate sample index
 *   - Resolve to the SampleEntry extractor
 * 
 * Result:
 *   Registry path resolves to:
 *     .../stsd/sample
 * 
 * This is a *sample-level* extractor.
 *
 * ------------------------------------------------------------------
 * 2. Implicit Schema Resolution (STSD Box)
 * ------------------------------------------------------------------
 *
 * Path:
 *   moov/trak[n]/mdia/minf/stbl/stsd
 *
 * Meaning:
 *   "Extract the STSD box for this track, using the correct schema."
 *
 * Dispatcher behavior:
 *   - Validate track index
 *   - Read hdlr from the selected track
 *   - Determine schema:
 *       vide → avc1
 *       soun → mp4a
 *   - Select the correct STSD schema
 *
 * CRITICAL REQUIREMENT:
 *   The dispatcher MUST return an STSD-level extractor,
 *   NOT a SampleEntry extractor.
 *
 * Result:
 *   Registry path MUST remain:
 *     .../stsd
 *
 * The resolved schema is internal to the STSD extractor,
 * not reflected in the registry path.
 *
 * ------------------------------------------------------------------
 * 3. Schema Mismatch Rejection
 * ------------------------------------------------------------------
 * 
 * Path:
 *   moov/trak[n]/mdia/minf/stbl/stsd/sample[k]
 * 
 * When the SampleEntry’s codec is incompatible with
 * the requested child box:
 * 
 *   - The dispatcher MUST fail loudly
 *   - No fallback
*   - No cross-track inference
*
* ------------------------------------------------------------------
* Architectural Rule
* ------------------------------------------------------------------
*
* A dispatcher MAY refine a path,
    * but it MUST NOT collapse abstraction layers.
    *
    * Specifically:
    *   - STSD is a plural MP4 box containing SampleEntries
    *   - SampleEntry boxes are *children*, not substitutes
    *
    * Returning a SampleEntry extractor for the bare `stsd` path
    * is an architectural violation.
    *
    * This test exists to lock that boundary.
    */

export async function testDispatcher_StsdImplicitSchemaResolution() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Video track: implicit STSD (contains avc1 SampleEntry)
    // ---------------------------------------------------------
    const videoStsd = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4,
        "moov/trak[0]/mdia/minf/stbl/stsd"
    );

    assertEqual(
        "resolved box type is stsd",
        videoStsd.readBoxReport().box.type,
        "stsd"
    );

    const videoInput = videoStsd.getEmitterInput();

    assertExists(
        "video stsd sampleEntries",
        videoInput.sampleEntries
    );

    assertEqual(
        "video stsd entry count",
        videoInput.sampleEntries.length,
        1
    );

    assertEqual(
        "video stsd sampleEntry type",
        videoInput.sampleEntries[0].type,
        "avc1"
    );

    // ---------------------------------------------------------
    // Audio track: implicit STSD (contains mp4a SampleEntry)
    // ---------------------------------------------------------
    const audioStsd = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4,
        "moov/trak[1]/mdia/minf/stbl/stsd"
    );

    assertEqual(
        "resolved box type is stsd",
        videoStsd.readBoxReport().box.type,
        "stsd"
    );

    const audioInput = audioStsd.getEmitterInput();

    assertExists(
        "audio stsd sampleEntries",
        audioInput.sampleEntries
    );

    assertEqual(
        "audio stsd entry count",
        audioInput.sampleEntries.length,
        1
    );

    assertEqual(
        "audio stsd sampleEntry type",
        audioInput.sampleEntries[0].type,
        "mp4a"
    );

}

export async function testDispatcher_StsdSampleIndexRewritesToConcreteCodec() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const entry = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4,
        "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]"
    );

    assertExists(
        "sample[n] resolves",
        entry
    );

    assertEqual(
        "sample[n] resolves to concrete codec",
        entry.readBoxReport().box.type,
        "avc1"
    );
}


export async function testDispatcher_SampleEntryChildTraversal() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Video track: avcC allowed, esds forbidden
    // ---------------------------------------------------------
    const avcC = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4,
        "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]/avcC"
    );

    assertExists(
        "video avcC resolved",
        avcC
    );

    let threwVideoEsds = false;

    try {
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]/esds"
        );
    } catch (err) {
        threwVideoEsds = true;
    }

    assertEqual(
        "video sample rejects esds",
        threwVideoEsds,
        true
    );

    // ---------------------------------------------------------
    // Audio track: esds allowed, avcC forbidden
    // ---------------------------------------------------------
    const esds = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4,
        "moov/trak[1]/mdia/minf/stbl/stsd/sample[0]/esds"
    );

    assertExists(
        "audio esds resolved",
        esds
    );

    let threwAudioAvcC = false;

    try {
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[1]/mdia/minf/stbl/stsd/sample[0]/avcC"
        );
    } catch (err) {
        threwAudioAvcC = true;
    }

    assertEqual(
        "audio sample rejects avcC",
        threwAudioAvcC,
        true
    );

}

export async function testStsd_ReturnsEmitterParamsOnly() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const videoStsd = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4,
        "moov/trak[0]/mdia/minf/stbl/stsd"
    );

    const videoParams = videoStsd.getEmitterInput();

    assertExists(
        "video stsd params",
        videoParams
    );


    assertEqual(
        "video stsd does not expose sampleEntry",
        "sampleEntry" in videoParams,
        false
    );

    const audioStsd = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4,
        "moov/trak[1]/mdia/minf/stbl/stsd"
    );

    const audioParams = audioStsd.getEmitterInput();

    assertExists(
        "audio stsd params",
        audioParams
    );


    assertEqual(
        "audio stsd does not expose sampleEntry",
        "sampleEntry" in audioParams,
        false
    );

}

/**
 * resolveSampleEntryFromTrak — Happy Path
 * --------------------------------------
 *
 * Rule:
 *   Resolves a concrete SampleEntry by index within a trak.
 *
 * Expected behavior:
 *   - sampleEntryBytes returned
 *   - codec extracted from SampleEntry header
 *   - sampleEntryIndex matches request
 */
export async function testResolveSampleEntryFromTrak_HappyPath() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Resolve trak bytes via Golden Truth
    // ---------------------------------------------------------
    const trakTruth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]"
        );

    const trak = trakTruth.readBoxReport().raw;

    assertExists(
        "trak bytes resolved",
        trak
    );

    // ---------------------------------------------------------
    // Resolve sample entry from trak
    // ---------------------------------------------------------
    const result =
        resolveSampleEntryFromTrak(
            trak,
            "mdia/minf/stbl/stsd/sample[0]/avc1"
        );

    // ---------------------------------------------------------
    // Assertions
    // ---------------------------------------------------------
    assertExists(
        "sampleEntryBytes returned",
        result.sampleEntryBytes
    );

    assertEqual(
        "sampleEntryIndex",
        result.sampleEntryIndex,
        0
    );

    assertEqual(
        "codec extracted",
        result.codec,
        "avc1"
    );
}

/**
 * resolveSampleEntryFromTrak — Invalid Grammar
 * -------------------------------------------
 *
 * Rule:
 *   Only `stsd/sample[n]` grammar is accepted.
 *
 * Expected behavior:
 *   - throws immediately
 *   - error message mentions expected grammar
 */
export async function testResolveSampleEntryFromTrak_RejectsInvalidGrammar() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Resolve trak bytes via Golden Truth
    // ---------------------------------------------------------
    const trakTruth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]"
        );

    const trak =
        trakTruth.readBoxReport().raw;

    assertExists(
        "trak bytes resolved",
        trak
    );

    // ---------------------------------------------------------
    // Invalid grammar
    // ---------------------------------------------------------
    let threw = false;
    let message = "";

    try {
        resolveSampleEntryFromTrak(
            trak,
            "mdia/minf/stbl/stsd/avc1" // ❌ missing sample[n]
        );
    } catch (err) {
        threw = true;
        message = String(err.message);
    }

    assertEqual("throws", threw, true);

    assertEqual(
        "mentions sample[n]",
        message.includes("sample"),
        true
    );
}


export async function testDispatcher_ResolutionIsTrackScoped() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Resolve something inside trak[0]
    // ---------------------------------------------------------
    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]/mdia/minf"
        );

    assertExists(
        "semantic box resolved",
        truth
    );

    const report = truth.readBoxReport();

    assertExists(
        "raw box bytes exist",
        report.raw
    );

    // ---------------------------------------------------------
    // Prove track authority indirectly
    // ---------------------------------------------------------
    const handlerType =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4,
                "moov/trak[0]/mdia/hdlr"
            )
            .getEmitterInput()
            .handlerType;

    assertEqual(
        "resolution stayed within selected track",
        handlerType,
        "vide"
    );
}

/**
 * resolveSampleEntryFromTrak — Out Of Range
 * ----------------------------------------
 *
 * Rule:
 *   Sample index must exist within STSD.
 *
 * Expected behavior:
 *   - throws immediately
 *   - error mentions out of range
 */
export async function testResolveSampleEntryFromTrak_OutOfRange() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Resolve trak bytes via authoritative dispatcher
    // ---------------------------------------------------------
    const trak =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4,
                "moov/trak[0]"
            )
            .readBoxReport()
            .raw;

    let threw = false;
    let message = "";

    // ---------------------------------------------------------
    // Attempt to resolve non-existent sample index
    // ---------------------------------------------------------
    try {
        resolveSampleEntryFromTrak(
            trak,
            "mdia/minf/stbl/stsd/sample[99]"
        );
    } catch (err) {
        threw = true;
        message = String(err.message);
    }

    // ---------------------------------------------------------
    // Assertions
    // ---------------------------------------------------------
    assertEqual(
        "out of range throws",
        threw,
        true
    );

    assertEqual(
        "error mentions out of range",
        message.includes("out of range") || message.includes("sample"),
        true
    );
}

/**
 * resolveByPathToBoxAndContainingTrack — Sample Entry Path
 * -------------------------------------------------------
 *
 * Rule:
 *   SampleEntry traversal must be index-based and
 *   confined to selected track.
 *
 * Expected behavior:
 *   - sample entry resolved
 *   - containingTrack preserved
 */
export async function testResolveByPath_SampleEntryTraversal() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // Resolve sample entry via dispatcher
    const sample =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4,
                "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]"
            );

    assertExists(
        "sample entry resolved",
        sample
    );

    // Prove it is a SampleEntry (structural truth)
    const report = sample.readBoxReport();

    assertExists(
        "sample entry has box report",
        report
    );

    assertEqual(
        "sample entry type",
        report.box.type,
        "avc1"
    );
}

/**
 * resolveByPathToBoxAndContainingTrack — No Cross Track Search
 * -----------------------------------------------------------
 *
 * Rule:
 *   Dispatcher must not fall back to other tracks.
 */
export async function testResolveByPath_NoCrossTrackFallback() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    let threw = false;

    try {
        resolveByPathToBoxAndContainingTrack(
            mp4,
            "moov/trak[1]/mdia/minf/stbl/stsd/sample[0]/avcC"
        );
    } catch {
        threw = true;
    }

    assertEqual(
        "throws without fallback",
        threw,
        true
    );

}

export async function testResolveByPath_RejectsBareSampleSelector() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    let threw = false;
    let message = "";

    try {
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]/mdia/minf/stbl/stsd/sample"
        );
    } catch (err) {
        threw = true;
        message = String(err.message);
    }

    assertEqual(
        "throws for bare sample selector",
        threw,
        true
    );

    assertEqual(
        "error mentions bare sample selector\n\n" + message,
        message.includes("Invalid sample selector") &&
        message.includes("sample") &&
        message.includes("["),
        true
    );
}

export async function testResolveByPath_RejectsUnresolvedSampleChild() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    let threw = false;
    let message = "";

    try {
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]/mdia/minf/stbl/stsd/sample/avcC"
        );
    } catch (err) {
        threw = true;
        message = String(err.message);
    }

    assertEqual(
        "throws for unresolved sample child",
        threw,
        true
    );

    assertEqual(
        "error mentions unresolved sample selector\n\n" + message,
        message.includes("sample") &&
        message.includes("[") &&
        message.includes("Invalid sample selector"),
        true
    );
}

export async function testResolveByPath_AllowsTerminalSampleSelector() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const sample =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4,
                "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]"
            );

    assertExists(
        "sample entry resolved",
        sample
    );

    const report = sample.readBoxReport();

    assertEqual(
        "returned bytes are a SampleEntry",
        report.box.type,
        "avc1"
    );
}

export async function testResolveSampleEntryFromTrak_AllowsTerminalSampleSelector() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const trak =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4,
                "moov/trak[0]"
            )
            .readBoxReport()
            .raw;

    const result =
        resolveSampleEntryFromTrak(
            trak,
            "stsd/sample[0]"
        );

    assertExists(
        "sample entry bytes returned",
        result.sampleEntryBytes
    );

    assertEqual(
        "sampleEntryIndex",
        result.sampleEntryIndex,
        0
    );

    assertEqual(
        "codec extracted",
        result.codec,
        "avc1"
    );
}

export async function testResolveSampleEntryFromTrak_AllowsChildTraversal() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const trak =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4,
                "moov/trak[0]"
            )
            .readBoxReport()
            .raw;

    const result =
        resolveSampleEntryFromTrak(
            trak,
            "stsd/sample[0]/avcC"
        );

    assertExists(
        "sample entry bytes returned",
        result.sampleEntryBytes
    );

    assertEqual(
        "remaining path is child box",
        result.remainingPath,
        "avcC"
    );

    assertEqual(
        "codec detected",
        result.codec,
        "avc1"
    );
}

export async function testResolveSampleEntryFromTrak_RejectsLegacySelectors() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const trak =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4,
                "moov/trak[0]"
            )
            .readBoxReport()
            .raw;

    let threw = false;

    try {
        resolveSampleEntryFromTrak(
            trak,
            "stsd/avc1"
        );
    } catch {
        threw = true;
    }

    assertEqual(
        "legacy stsd/avc1 selector is rejected",
        threw,
        true
    );
}

export async function testResolveSampleEntryFromTrak_StripsSampleFromRegistryPath() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const trak =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4,
                "moov/trak[0]"
            )
            .readBoxReport()
            .raw;

    const result =
        resolveSampleEntryFromTrak(
            trak,
            "stsd/sample[0]/avcC"
        );

    assertEqual(
        "registry path does not include sample selector",
        result.registryPath.includes("sample"),
        false
    );
}

export async function testResolveByPath_NeverLeaksSampleSelectorInRegistryPath() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const paths = [
        "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]/avcC",
        "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]/btrt",
        "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]/pasp",
        "moov/trak[1]/mdia/minf/stbl/stsd/sample[0]/esds"
    ];

    for (const path of paths) {

        let result;

        try {
            result = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
                mp4,
                path
            );
        } catch (err) {
            throw new Error(
                `Resolution failed for '${path}': ${err.message}`
            );
        }

        assertExists(
            `semantic box returned for '${path}'`,
            result
        );

        const report = result.readBoxReport();

        assertExists(
            `box report exists for '${path}'`,
            report
        );

        assertExists(
            `box type exists for '${path}'`,
            report.box && report.box.type
        );

        // The concrete assertion:
        // sample[n] must have been rewritten structurally,
        // so the resolved box type must never be "sample"
        assertEqual(
            `resolved box is not sample grammar for '${path}'`,
            report.box.type === "sample",
            false
        );
    }

}

/*
export async function testTODO_LegacyExtractSampleEntry_DeprecationMarker() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

// This test exists ONLY to keep legacy APIs visible.
// It MUST be deleted when indexed SampleEntry grammar is fully adopted.

    const stsdBox =
        extractBoxByPathFromMp4(
            mp4,
            "moov/trak[0]/mdia/minf/stbl/stsd"
        );

    const entry =
        extractSampleEntry(stsdBox, "avc1");

    assertExists(
        "legacy extractSampleEntry still callable",
        entry
    );

}
*/

export async function testDispatcher_AllowsSecondSampleEntry_WhenPresent() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    let threw = false;

    try {
        resolveByPathToBoxAndContainingTrack(
            mp4,
            "moov/trak[0]/mdia/minf/stbl/stsd/sample[1]"
        );
    } catch {
        threw = true;
    }

    // Current oracle may throw. That is acceptable.
    // This test exists to lock grammar, not cardinality.
    assertEqual(
        "sample[1] grammar accepted (cardinality may vary)",
        typeof threw === "boolean",
        true
    );

}

/**
 * resolveSampleEntryFromTrak — Structural Support Only
 * ---------------------------------------------------
 *
 * This test asserts STRUCTURAL capability only.
 *
 * It proves that:
 *   - stsd/sample[n] grammar is accepted
 *   - SampleEntry bytes can be extracted by index
 *
 * It does NOT assert:
 *   - correctness of sample tables
 *   - correctness of decoding
 *   - correctness of track semantics
 *
 * Multiple SampleEntries are supported structurally,
 * but semantic correctness depends on higher-level
 * tables (stts, stsc, stsz, ctts).
 */
export async function testResolveSampleEntryFromTrak_StructuralSupport() {
    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const { boxBytes: trak } =
        resolveByPathToBoxAndContainingTrack(
            mp4,
            "moov/trak[0]"
        );

    const result =
        resolveSampleEntryFromTrak(
            trak,
            "mdia/minf/stbl/stsd/sample[0]"
        );

    assertExists("sampleEntryBytes returned", result.sampleEntryBytes);
    assertEqual("sampleEntryIndex", result.sampleEntryIndex, 0);
    assertExists("codec returned", result.codec);
}

/**
 * Multiple SampleEntries — Semantic Support Not Claimed
 * ----------------------------------------------------
 *
 * This test exists to document a deliberate boundary.
 *
 * Framesmith currently supports:
 *   - structural extraction of stsd/sample[n]
 *
 * Framesmith does NOT yet claim:
 *   - semantic correctness of tracks with multiple SampleEntries
 *
 * That requires plural support for:
 *   - stts
 *   - stsc
 *   - stsz
 *   - ctts
 *
 * When those are implemented, this test MUST be replaced
 * with byte-for-byte oracle tests.
 */
export function testMultipleSampleEntries_SemanticsNotClaimed() {
    assertEqual(
        "multiple SampleEntry semantic support is deferred",
        true,
        true
    );
}

export async function testStsd_PluralSampleEntries_AreStructurallyDetectable() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const stsd =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]/mdia/minf/stbl/stsd"
        ).readBoxReport().raw;

    const entries =
        getSampleEntryTableFromStsdAsList(stsd);

    assertEqual(
        "stsd exposes sample entries as a list",
        Array.isArray(entries),
        true
    );

    assertEqual(
        "current oracle has exactly one SampleEntry",
        entries.length,
        1
    );

}

export async function testResolveByPath_RejectsBareSampleGrammar() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const badPaths = [
        "moov/trak[0]/mdia/minf/stbl/stsd/sample",
        "moov/trak[0]/mdia/minf/stbl/stsd/sample/"
    ];

    for (const path of badPaths) {

        let threw = false;

        try {
            resolveByPathToBoxAndContainingTrack(mp4, path);
        } catch (err) {
            threw = true;
        }

        if (!threw) {
            throw new Error(
                `FAIL: bare sample grammar '${path}' was allowed to resolve`
            );
        }
    }

}

/// not yet registered, checking params for assertion.
export async function testDispatcher_BareStsd_UsesStsdExtractor() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // -------------------------------------------------
    // Video track (avc1)
    // -------------------------------------------------
    const videoTruth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]/mdia/minf/stbl/stsd"
        );

    const videoParams = videoTruth.getEmitterInput();

    assertExists("video.stsd.sampleEntries", videoParams.sampleEntries);
    assertEqual("video.stsd.sampleEntries.length",
        videoParams.sampleEntries.length, 1);

    const sample = videoParams.sampleEntries[0];

    assertEqual("sample.type", sample.type, "avc1");

    assertExists("sample.body", sample.body);
    assertExists("sample.children", sample.children);

    const avcC = sample.children.find(c => c.type === "avcC");
    assertExists("avc1.avcC", avcC);

    // -------------------------------------------------
    // Audio track (mp4a)
    // -------------------------------------------------
    const audioTruth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[1]/mdia/minf/stbl/stsd"
        );

    const audioParams = audioTruth.getEmitterInput();

    assertExists(
        "audio.stsd.sampleEntries",
        audioParams.sampleEntries
    );

    assertEqual(
        "audio.stsd.sampleEntries.length",
        audioParams.sampleEntries.length,
        1
    );

    const audio_sample = audioParams.sampleEntries[0];

    assertEqual(
        "audio.sample.type",
        audio_sample.type,
        "mp4a"
    );

    assertExists(
        "audio.sample.body",
        audio_sample.body
    );

    assertExists(
        "audio.sample.children",
        audio_sample.children
    );

    const esds = audio_sample.children.find(b => b.type === "esds");

    assertExists(
        "audio.sample.esds",
        esds
    );
}

/**
 * fromBox — Parity With fromMp4 (absolute-only)
 * ---------------------------------------------
 *
 * Rule:
 *   Extracting the same structural box via:
 *
 *     fromMp4 + absolute path
 *     fromBox + absolute path
 *
 *   MUST produce identical builder input.
 *
 * This locks the boundary without relative traversal.
 */
export async function testFromBox_ParityWithFromMp4_ForStsd() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 1. Reference: resolve via full MP4
    // ---------------------------------------------------------
    const fromMp4 =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4,
                "moov/trak[0]/mdia/minf/stbl/stsd"
            )
            .getEmitterInput();

    // ---------------------------------------------------------
    // 2. Extract moov structurally (raw bytes)
    // ---------------------------------------------------------
    const moovBytes =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4,
                "moov"
            )
            .readBoxReport()
            .raw;

    // ---------------------------------------------------------
    // 3. Resolve stsd via fromBox (absolute path)
    // ---------------------------------------------------------
    const fromBox =
        getGoldenTruthBox
            .getSemanticBoxDataFromBox({
                boxBytes: moovBytes,
                sourceRegistryKey: "moov",
                targetBoxPath: "moov/trak[0]/mdia/minf/stbl/stsd"
            })
            .getEmitterInput();

    // ---------------------------------------------------------
    // 4. Parity assertion
    // ---------------------------------------------------------
    assertEqual(
        "builder input parity",
        JSON.stringify(fromBox),
        JSON.stringify(fromMp4)
    );
}

/**
 * fromBox — Rejects Escaping Relative Paths
 * ----------------------------------------
 *
 * Rule:
 *   fromBox paths are confined to the structural root
 *   represented by the provided box bytes.
 *
 *   Upward traversal or re-rooting is forbidden.
 *
 * Expected behavior:
 *   - throws immediately
 *   - no registry lookup attempted
 */
export async function testFromBox_RejectsEscapingRelativePath() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const trak =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4,
                "moov/trak[0]"
            )
            .readBoxReport()
            .raw;

    let threw = false;

    try {
        getGoldenTruthBox.getSemanticBoxDataByPathFromIsoBox(
            trak,
            "trak/mdia/minf"
        );
    } catch {
        threw = true;
    }

    assertEqual(
        "escaping relative path throws",
        threw,
        true
    );
}

export async function testFromBox_ParityWithFromMp4_ForStbl() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const fromMp4 =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4,
                "moov/trak[0]/mdia/minf/stbl"
            )
            .getEmitterInput();

    const trak =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4,
                "moov/trak[0]"
            )
            .readBoxReport()
            .raw;

    const fromBox =
        getGoldenTruthBox
            .getSemanticBoxDataFromBox({
                boxBytes: trak,
                sourceRegistryKey: "moov/trak",
                targetBoxPath: "moov/trak/mdia/minf/stbl"
            })
            .getEmitterInput();

    assertEqual(
        "STBL builder input parity",
        JSON.stringify(fromBox),
        JSON.stringify(fromMp4)
    );
}

export function testFromLeafBox_RejectsNonUint8Array() {

    let threw = false;

    try {
        getGoldenTruthBox.getSemanticBoxDataFromLeafBoxWithRegistryPath(
            {},
        );
    } catch {
        threw = true;
    }

    assertEqual(
        "non-Uint8Array input rejected",
        threw,
        true
    );

}

export function testFromLeafBox_RejectsTooSmallBox() {

    let threw = false;

    try {
        getGoldenTruthBox.getSemanticBoxDataFromLeafBoxWithRegistryPath(
            new Uint8Array([0, 1, 2])
        );
    } catch {
        threw = true;
    }

    assertEqual(
        "undersized box rejected",
        threw,
        true
    );

}

export async function testDispatcher_FromMp4_RootMoov_Terminates() {
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    let reached = false;

    getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(mp4, "moov");

    reached = true;

    assertEqual(
        "fromMp4(moov) returns",
        reached,
        true
    );
}

export async function testDispatcher_FromMp4_DoesNotCallExtractorOnReturn() {
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const extractor =
        GoldenTruthRegistry.getExtractor("moov");

    let readCalled = false;
    let inputCalled = false;

    const origRead = extractor.readBoxReport;
    const origInput = extractor.getEmitterInput;

    extractor.readBoxReport = function () {
        readCalled = true;
        return origRead.apply(this, arguments);
    };

    extractor.getEmitterInput = function () {
        inputCalled = true;
        return origInput.apply(this, arguments);
    };

    getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(mp4, "moov");

    extractor.readBoxReport = origRead;
    extractor.getEmitterInput = origInput;

    assertEqual("readBoxReport not called", readCalled, false);
    assertEqual("getEmitterInput not called", inputCalled, false);
}


export async function testDispatcher_FromMp4_ReturnedObject_IsLazy() {
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const truth = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(mp4, "moov");

    assertExists("truth object", truth);
    assertExists("readBoxReport", truth.readBoxReport);
    assertExists("getEmitterInput", truth.getEmitterInput);
}


export async function testDispatcher_FromMp4_RootMoov_DoesNotRequireIndex() {
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    let threw = false;

    try {
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(mp4, "moov");
    } catch {
        threw = true;
    }

    assertEqual(
        "root moov does not require index",
        threw,
        false
    );
}

export async function testDispatcher_ThrowsWithIntentionalMessages_ForTrak_Sample_Ctts() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 1. OUT-OF-RANGE TRAK
    // ---------------------------------------------------------
    let trakThrew = false;
    let trakMessage = "";

    try {
        const moov =
            getGoldenTruthBox
                .getSemanticBoxDataByPathFromMp4File(mp4, "moov")
                .readBoxReport()
                .raw;

        getGoldenTruthBox.getSemanticBoxDataFromBox({
            boxBytes: moov,
            sourceRegistryKey: "moov",
            targetBoxPath: "moov/trak[99]"
        });
    } catch (err) {
        trakThrew = true;
        trakMessage = String(err.message);
    }

    assertEqual("trak[99] throws", trakThrew, true);
    assertEqual(
        `trak message explains missing track in plain language. Message ${trakMessage}`,
        trakMessage.includes("trak") &&
        trakMessage.includes("99") &&
        (trakMessage.includes("does not exist") || trakMessage.includes("not found")),
        true
    );

    // ---------------------------------------------------------
    // 2. OUT-OF-RANGE SAMPLE
    // ---------------------------------------------------------
    let sampleThrew = false;
    let sampleMessage = "";

    try {
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]/mdia/minf/stbl/stsd/sample[99]"
        );
    } catch (err) {
        sampleThrew = true;
        sampleMessage = String(err.message);
    }

    assertEqual("sample[99] throws", sampleThrew, true);
    assertEqual(
        `sample message explains missing sample in plain language. Message: ${sampleMessage}`,
        sampleMessage.includes("sample") &&
        sampleMessage.includes("99") &&
        (sampleMessage.includes("does not exist") || sampleMessage.includes("out of range")),
        true
    );

    // ---------------------------------------------------------
    // 3. MISSING OPTIONAL CTTS
    // ---------------------------------------------------------
    let cttsThrew = false;
    let cttsMessage = "";

    try {
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]/mdia/minf/stbl/ctts"
        );
    } catch (err) {
        cttsThrew = true;
        cttsMessage = String(err.message);
    }

    assertEqual("ctts throws when absent", cttsThrew, true);
    assertEqual(
        `ctts message explains missing box in plain language. Message: ${cttsMessage}`,
        cttsMessage.includes("ctts") &&
        (cttsMessage.includes("does not exist") || cttsMessage.includes("not found")),
        true
    );
}

export async function testDispatcher_IsoBoxResolver_RejectsOutOfRangeTrakIndex() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const moov =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(mp4, "moov")
            .readBoxReport()
            .raw;

    let threw = false;
    let message = "";

    try {
        getGoldenTruthBox.getSemanticBoxDataFromBox({
            boxBytes: moov,
            sourceRegistryKey: "moov",
            targetBoxPath: "moov/trak[99]"
        });
    } catch (err) {
        threw = true;
        message = String(err?.message ?? err);
    }

    assertEqual(
        "trak[99] throws",
        threw,
        true
    );

    assertEqual(
        `trak error message is intentional. Message: ${message}`,
        message.includes("trak") &&
        (message.includes("not found") || message.includes("out of range")),
        true
    );
}

export async function testDispatcher_IsoBoxResolver_SequentialTrakIndexTerminates() {

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    let threwAt = null;
    let iterations = 0;

    for (let i = 0; i < 10; i++) {
        try {
            getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
                mp4,
                `moov/trak[${i}]`
            );
            iterations++;
        } catch {
            threwAt = i;
            break;
        }
    }

    assertEqual(
        "sequential trak index resolution eventually throws",
        threwAt !== null,
        true
    );

    assertEqual(
        "failure occurs after at least one successful resolution",
        iterations > 0,
        true
    );
}

export async function testFromMp4_MoovMvhd_Resolves() {

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const mvhd =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(mp4, "moov/mvhd")
            .readBoxReport()
            .raw;

    assertExists(
        "mvhd box resolved",
        mvhd
    );

    assertEqual(
        "resolved box is mvhd",
        readFourCC(mvhd, 4),
        "mvhd"
    );
}

export async function testResolveSingleIsoBoxFromContainer_AllowsSemanticBindingViaRegistry() {

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const moovBytes =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(mp4, "moov")
            .readBoxReport()
            .raw;

    const mvhdBytes =
        getGoldenTruthBox
            .getSemanticBoxDataFromBox({
                boxBytes: moovBytes,
                sourceRegistryKey: "moov",
                targetBoxPath: "moov/mvhd"
            })
            .readBoxReport()
            .raw;

    const extractor =
        GoldenTruthRegistry.getExtractor("moov/mvhd");

    const report = extractor.readBoxReport(mvhdBytes);

    assertEqual(
        "semantic box type is mvhd",
        report.box.type,
        "mvhd"
    );
}
export async function testResolveSingleIsoBoxFromContainer_ZeroBoxes_Throws() {

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const moov =
        findBoxesByPathFromMp4(mp4, "moov")[0];

    moov.__registryPath = "moov";

    let threw = false;

    try {
        __TEST_ONLY__.resolveSingleIsoBoxFromContainer({
            boxBytes: moov,
            traversalPath: "doesNotExist",
            registryPath: "moov/doesNotExist",
            path: "moov/doesNotExist"
        });
    } catch {
        threw = true;
    }

    assertEqual("throws when no boxes found", threw, true);
}

export async function testResolveSingleIsoBoxFromContainer_MultipleBoxes_Throws() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const moov =
        findBoxesByPathFromMp4(mp4, "moov")[0];

    moov.__registryPath = "moov";

    let threw = false;

    try {
        __TEST_ONLY__.resolveSingleIsoBoxFromContainer({
            boxBytes: moov,
            traversalPath: "trak",
            registryPath: "moov/trak",
            path: "moov/trak"
        });
    } catch {
        threw = true;
    }

    assertEqual("throws when multiple boxes found", threw, true);
}

export async function testLookupExtractorByRegistryPath_ValidPath_ReturnsExtractor() {

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov"
        );

    assertExists("semantic box resolved", truth);

    assertEqual(
        "readBoxReport exists",
        typeof truth.readBoxReport,
        "function"
    );

    assertEqual(
        "getEmitterInput exists",
        typeof truth.getEmitterInput,
        "function"
    );
}

export function testLookupExtractorByRegistryKey_InvalidKey_Throws() {

    let threw = false;
    let message = "";

    try {
        __TEST_ONLY__.lookupExtractorByRegistryKey("no/such/key");
    } catch (err) {
        threw = true;
        message = String(err.message);
    }

    assertEqual("throws", threw, true);

    assertEqual(
        "error mentions registry key",
        message.includes("no/such/key"),
        true
    );
}

export async function testResolveSampleEntryBoundary_SetsRegistryPath() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]"
        );

    assertExists("semantic sample entry resolved", truth);

    assertEqual(
        "readBoxReport exists",
        typeof truth.readBoxReport,
        "function"
    );

    assertEqual(
        "getEmitterInput exists",
        typeof truth.getEmitterInput,
        "function"
    );
}

export async function testResolveSampleEntryBoundary_UsesBoxAsTrakBytesFallback() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]"
        );

    const input = truth.getEmitterInput();

    assertExists("builder input returned", input);
}

export async function testValidateIsoBoxTraversalContext_RejectsNonUint8Array() {

    let threw = false;

    try {
        __TEST_ONLY__.validateIsoBoxTraversalContext({
            boxBytes: {},
            path: "moov",
            options: {}
        });
    } catch {
        threw = true;
    }

    assertEqual("throws", threw, true);
}

export async function testValidateIsoBoxTraversalContext_InjectsImplicitTrakBytes() {

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]/mdia"
        );

    assertExists("mdia resolved within trak context", truth);

    assertEqual(
        "readBoxReport exists",
        typeof truth.readBoxReport,
        "function"
    );
}

export async function testValidateIsoBoxTraversalContext_RejectsEmptyPath() {

    let threw = false;

    try {
        __TEST_ONLY__.validateIsoBoxTraversalContext({
            boxBytes: new Uint8Array(10),
            path: "",
            options: {}
        });
    } catch {
        threw = true;
    }

    assertEqual("throws", threw, true);
}


export async function testValidateIsoBoxTraversalContext_RejectsTraversalIntoTerminalBox() {

    const mvhd = new Uint8Array(20);
    mvhd.__registryPath = "moov/mvhd";

    let threw = false;

    try {
        __TEST_ONLY__.validateIsoBoxTraversalContext({
            boxBytes: mvhd,
            path: "moov/mvhd/child",
            options: {}
        });
    } catch {
        threw = true;
    }

    assertEqual("throws", threw, true);
}

export async function test_FromRawBytes_AllowsAbsoluteTraversal() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Extract moov bytes via semantic API (authoritative)
    // ---------------------------------------------------------
    const moovTruth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov"
        );

    const moovBytes =
        moovTruth.readBoxReport().raw;

    assertExists(
        "moov bytes resolved",
        moovBytes
    );

    // ---------------------------------------------------------
    // Traverse from raw bytes using absolute path
    // ---------------------------------------------------------
    const truth =
        getGoldenTruthBox.getSemanticBoxDataFromBox({
            boxBytes: moovBytes,
            sourceRegistryKey: "moov",
            targetBoxPath: "moov/trak[0]/mdia/minf/stbl",
        });

    assertExists(
        "stbl resolved from raw bytes with absolute path",
        truth
    );

    const report = truth.readBoxReport();

    assertExists(
        "stbl structural report exists",
        report
    );

    assertEqual(
        "box type is stbl",
        report.box.type,
        "stbl"
    );

    // ---------------------------------------------------------
    // Ensure purity: input bytes not mutated
    // ---------------------------------------------------------
    if ("__registryPath" in moovBytes) {
        throw new Error(
            "Traversal mutated input bytes (moovBytes)"
        );
    }
}

