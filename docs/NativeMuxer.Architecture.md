## Architectural Data Flow (Normative)

NativeMuxer operates as a strict, ordered compiler pipeline.
Data flows in one direction only.

```
semantic input
→ normalization
→ derivation
→ policy application
→ adapter normalization
→ emitter parameter objects
→ box emitters
→ physical layout resolution
→ serialization
→ assembly
```

Each stage consumes fully-formed outputs from the previous stage.
No stage may infer, repair, or guess missing information.


# NativeMuxer Architecture

A deterministic, dependency-free MP4 muxer designed for browser environments and WebCodecs output.

This document defines the **current architectural truth** of the NativeMuxer.
It is not historical.
It does not explain how decisions were reached.
It describes what **is**, what **must remain**, and what **is forbidden**.

All NativeMuxer code and future changes must conform to the architectural contract described in this document, as validated by the test suite.
---

## 1. Purpose

NativeMuxer exists to:

* Accept encoded H.264 video samples
* Produce a valid, deterministic MP4 file
* Without external muxing libraries
* Without implicit structure
* Without lossy or heuristic behavior

NativeMuxer is a **compiler**, not a convenience wrapper.

---

## 2. Core Characteristics

NativeMuxer is:

* **Pure**: no hidden global state
* **Deterministic**: identical input produces identical output
* **Synchronous internally**: no async behavior in core logic
* **Dependency-free**: no runtime reliance on external muxers
* **Spec-constrained**: ISO BMFF structure is enforced, not inferred
* **Test-driven**: byte-level equivalence is mandatory

NativeMuxer is **not**:

* A media encoder
* A demuxer
* A streaming container
* A forgiving or heuristic writer

---

## 3. High-Level Structure

The MP4 file produced by NativeMuxer has the following fixed structure:

```
[ftyp]
[optional free]
[mdat]
[moov]
```

No alternative ordering is permitted.

---

## 4. Architectural Boundaries

NativeMuxer is composed of **multiple strictly ordered layers**, each with fixed responsibilities.

### 4.1 Golden Truth Extractors (TEST-ONLY, NON-ARCHITECTURAL)

Golden truth extractors exist **only inside the test suite**.

They:
* read real MP4 files (e.g. ffmpeg output)
* extract canonical semantic meaning
* act as a correctness oracle for NativeMuxer tests

They are:
* not part of NativeMuxer
* not reusable
* not generic parsers
* not a production abstraction

Rules:
* No production code may depend on golden truth extractors
* No architectural decision may assume their existence
* They exist solely to answer: “what does reality do?”

NativeMuxer production code contains no MP4 container readers.
It never consumes MP4 container bytes.

NativeMuxer consumes a validated semantic compiler input
(`Mp4BuildInput`) and nothing else.

---

### 4.2 Normalization Layer (Semantic → Semantic)

**Purpose**  
Normalize semantic inputs into a complete, explicit internal representation.

**Responsibilities**

* Validate required semantic fields
* Normalize timing units and sample shapes
* Eliminate ambiguity before derivation
* Ensure downstream stages never infer meaning

**Rules**

* Normalization operates only on semantic data
* No MP4 structure knowledge is permitted
* No byte access is permitted
* No policy decisions are permitted

---

### 4.3 Derivation Layer (Semantic inputs → Derived Semantics)

**Purpose**  
Derive MP4 table meaning from semantic samples and chunk models.

**Responsibilities**

* Derive STTS entries
* Derive STSZ sizes
* Derive STSC entries
* Derive STSS entries
* Derive provisional STCO offsets (mdat-relative only)

**Characteristics**

* Pure
* Deterministic
* No byte access
* No serialization
* No file offsets

**Rules**

* Derivation operates only on:
  * normalized semantic inputs
  * chunk model

* Derivation must not:
  * inspect MP4 bytes
  * depend on box sizes
  * assume file layout


### 4.4 Adapter Layer (Semantic → Emitter Parameters)

**Purpose**  
Adapt derived semantic structures into normalized, emitter-ready parameter objects.

**Responsibilities**

* Validate derived semantic tables
* Normalize shapes and field presence
* Enforce current representational constraints
* Produce explicit emitter input contracts

**Rules**

* Adapters operate only on derived semantic data
* Adapters produce no MP4 structure
* Adapters emit no bytes
* Adapters perform no layout decisions
* Adapters must not apply policy

The output of this layer defines the **emitter parameter object** contract.

* Adapter outputs are frozen
* No downstream mutation is allowed

Emitters must accept only these parameter objects.
They must not accept raw semantic structures, derived tables, or policy state.

### 4.5 Policy Layer (Semantic → Semantic)

**Purpose**  
Apply explicit, testable decisions where multiple valid MP4 representations
exist for the same semantic meaning.

Policy runs before adapters.

**Responsibilities**

* Select movie-level timescale
* Apply edit list policy
* Decide optional container inclusion (e.g. udta/meta)
* Resolve representation choices without inventing semantics

**Rules**

* Policy operates only on normalized semantic data
* Policy produces new semantic facts
* Policy must never emit structure
* Policy must never emit bytes
* Policy must never infer missing input
* All policy decisions must be explicit and test-covered

---

### 4.6 Structural Layer (Box Emitters)

**Purpose**  
Emit declarative MP4 box structure from fully-derived semantic inputs.

**Characteristics**

* Deterministic
* Stateless
* Pure functions
* No calculations
* No derivation
* Declarative output only


**Emitter Output Contract**

Each emitter returns a single declarative **BoxNode** that describes structure only:


```js
{
    type: "xxxx",
    version?: number,
    flags?: number | object,
    flagBits?: object,
    body?: Field[],
    children?: BoxNode[]
}
```

Rules

  * Emitters never accept raw bytes, except where explicitly permitted by the serializer DSL.

    Clarification:

    * `mdat` emitters may use `{ OpaqueBytesPassthrough }` for media payloads
    * `udta` may be emitted as a fully opaque raw box (`{ bytes: Uint8Array }`)
    * No other box types may accept raw bytes in any form

 * Emitters never read or traverse MP4 container bytes
 * Emitters never derive meaning
 * Emitters never compute offsets or sizes
 * Emitters never serialize
 * Each MP4 box has exactly one emitter.

---

### 4.6.1 SampleEntry Boundary Rule

`stsd` is a structural boundary where normal ISO box traversal rules
temporarily change.

Rules:

* `stsd` contains a table of **SampleEntry records**
* SampleEntries (`avc1`, `mp4a`, etc.) are **not generic ISO container boxes**
* Child boxes inside a SampleEntry (e.g. `avcC`, `esds`, `pasp`, `btrt`)
  must be interpreted **relative to the enclosing SampleEntry**, not as
  normal `children` of `stsd`

Implications:

* Traversal code must explicitly enter a SampleEntry context
* Traversal code must explicitly exit SampleEntry context
* SampleEntry traversal must not be inferred from box type strings
* SampleEntry child traversal must never leak into normal container logic

SampleEntry interpretation is **codec- and track-type specific**.

Examples:

* `avc1` is valid only in `video` tracks
* `mp4a` is valid only in `audio` tracks
* `esds` under `avc1` is invalid
* `avcC` under `mp4a` is invalid

Violations of these rules must result in explicit errors, not silent failure
or fallback behavior.

---

### 4.6.2 Codec-Owned vs Container-Owned SampleEntry Responsibility

SampleEntry boxes (`avc1`, `mp4a`, etc.) sit at a critical architectural boundary.

They are:

* part of the MP4 container
* but owned semantically by the codec they describe

NativeMuxer makes an **explicit, asymmetric decision** about how different SampleEntry types are handled.

This decision is intentional and architectural.

---

#### Container-Owned SampleEntries (avc1)

NativeMuxer **constructs and owns** the `avc1` SampleEntry.

This means:

* NativeMuxer emits the complete VisualSampleEntry structure
* All fixed fields are explicit and spec-constrained
* `avcC` is treated as structured codec configuration
* Optional container-level extensions (`btrt`, `pasp`) are applied via policy
* Byte-for-byte equivalence with ffmpeg output is mandatory

Rationale:

* The MP4-level structure of `avc1` is shallow, stable, and well-defined
* Container-level correctness is critical for browser playback
* `avc1` fields are largely independent of H.264 bitstream semantics
* Deterministic rebuilding is achievable and testable
* NativeMuxer can safely enforce container invariants without interpreting codec internals

As a result, `avc1` is treated as **container-owned structure with codec-provided configuration**.

NativeMuxer does **not** interpret H.264 bitstreams.
It owns only the container representation.

---

#### Codec-Owned SampleEntries (mp4a)

NativeMuxer **does not construct** the `mp4a` SampleEntry.

Instead:

* `mp4a` is treated as an opaque SampleEntry
* The `esds` descriptor graph is preserved byte-for-byte
* No container-level mutation is performed
* No descriptor lengths are recomputed
* No audio codec semantics are inferred or derived

Rationale:

* `mp4a` correctness depends on ISO/IEC 14496-1 descriptor graphs
* Descriptor structure is recursive and length-sensitive
* Any mutation requires full descriptor parsing and re-serialization
* Partial understanding would produce silent corruption
* NativeMuxer is a container compiler, not an AAC descriptor compiler

Treating `mp4a` as opaque is **honest and safe**.

It preserves determinism without pretending to understand codec internals.

---

#### Architectural Rule

NativeMuxer distinguishes SampleEntry handling based on **where correctness responsibility lives**:

* If correctness lives primarily at the container level
  → NativeMuxer may build and validate the SampleEntry (`avc1`)
* If correctness lives primarily inside codec-specific descriptor graphs
  → NativeMuxer must preserve the SampleEntry verbatim (`mp4a`)

This is **not** a limitation of the architecture.

It is an explicit boundary.

---

#### Future Extension (Non-Architectural)

NativeMuxer may, in the future, implement full descriptor parsing and emission for audio SampleEntries.

If and only if that occurs:

* `mp4a` handling must meet the same standards as `avc1`
* Full descriptor graphs must be rebuilt deterministically
* Byte-for-byte equivalence must be proven
* Descriptor ownership rules must be explicit and test-covered

Until then:

* `mp4a` remains codec-owned
* `avc1` remains container-owned
* Mixing the two models is forbidden

---

#### Forbidden States

The following are architectural errors:

* Mutating `esds` without full descriptor recomputation
* Applying container policy inside audio descriptor graphs
* Treating `mp4a` as partially structured
* Allowing SampleEntry rebuilding without byte-for-byte proof

NativeMuxer prefers **explicit opacity** over **implicit corruption**.

---

That section locks the decision down.

It explains **what is owned**, **why**, and **what would have to change** for the boundary to move, without promising or implying anything.

If you want, next we can:

* update `stsd` emitter docs to reference this rule explicitly, or
* add a short “Codec Ownership Matrix” table (avc1, mp4a, future codecs) to make this visible at a glance.

---

## 4.6.3 SampleEntry Emitters Are Atomic

SampleEntry emitters (`avc1`, `mp4a`, etc.) are **atomic structural units**, even when they internally emit child boxes.

### Rule

A SampleEntry emitter **may call other emitters internally**.

This is:

* NOT structural delegation
* NOT container assembly
* NOT emitter composition in the container sense

It is **atomic emission**.

### Rationale

SampleEntries are:

* not ISO container boxes
* not governed by generic container traversal rules
* codec-defined structures with internal layout requirements

Child boxes such as:

* `avcC`
* `esds`
* `pasp`
* `btrt`

are **intrinsic parts of the SampleEntry**, not independent container children.

As a result:

* SampleEntry structure must be defined *entirely* by the SampleEntry emitter
* Parent containers (`stsd`, `stbl`, `trak`, etc.) must treat SampleEntries as opaque nodes
* No parent container may:

  * inspect SampleEntry internals
  * reorder SampleEntry children
  * assemble SampleEntry sub-boxes
  * apply policy inside a SampleEntry

### Examples

The following is explicitly allowed and correct:

```js
emitAvc1SampleEntryBox({
  avcC,
  btrt,
  pasp
})
```

Where `emitAvc1SampleEntryBox` internally calls:

* `emitAvcCBox`
* `emitPaspBox`
* `emitBtrtBox`

These calls are **implementation details**, not architectural composition.

### Boundary Enforcement

This rule enforces a strict separation:

* **Container emitters** assemble boxes
* **SampleEntry emitters** define boxes

Crossing this boundary is a structural error.

### Forbidden States

The following are architectural violations:

* Emitting SampleEntry child boxes outside the SampleEntry emitter
* Passing partially constructed SampleEntry children into `stsd`
* Treating SampleEntry children as normal ISO container children
* Reassembling SampleEntry structure at a higher layer

NativeMuxer prefers **atomic SampleEntry definition** over fragmented construction.

---

### 4.7 Physical Layout Resolution Layer

**Purpose**  
Resolve absolute file layout once all structure is known.

**Responsibilities**

* Fix file-level box ordering
* Compute absolute box offsets
* Determine mdat header size
* Finalize absolute STCO offsets

**Characteristics**

* Deterministic
* Policy-free
* No serialization
* No byte mutation

**Rules**

* This is the **only layer** where file offsets exist
* No box builder may know its own offset
* STCO finalization occurs here and nowhere else in production code

---

## 4.8 Serialization Layer (Structural → Bytes)

### 4.8.1 Structural Validation (Current)

The serializer enforces the **MP4 Box Tree DSL** and rejects:

* malformed box nodes
* invalid field shapes
* illegal raw byte usage
* unsupported body field types
* invalid child placement (e.g. wrapped boxes in `children`)
* ambiguous serialization cases

This validation guarantees that **every emitted byte stream is structurally well-formed** according to ISO BMFF encoding rules.

The serializer is:

* strict
* non-heuristic
* non-correcting
* fail-fast

Any violation of the DSL results in an immediate error.

---

### 4.8.2 Semantic Validation (Planned, Explicit)

In addition to structural correctness, the serializer is intended to enforce **semantic correctness of MP4 container structure**.

Semantic correctness means enforcing rules such as:

* which child boxes are **permitted** within a given container
* which child boxes are **required**
* valid **cardinality** (exactly one, at least one, zero or more)
* valid **ordering** constraints where mandated by the spec or canonical practice

Examples (non-exhaustive):

* `stbl` may contain only sample table boxes (`stsd`, `stts`, `stsc`, `stsz`, `stco`, `co64`, etc.)
* `free` is **never** a valid child of `stbl`
* `minf` must contain exactly one media header (`vmhd`, `smhd`, etc.), one `dinf`, and one `stbl`
* `mdat` may not contain child boxes
* `ftyp` must appear exactly once at file scope

These rules are semantic and must be enforced at a single, explicit boundary.
In the current architecture, that boundary is the serializer.
---

### 4.8.3 Current Transitional State

At present:

* The serializer enforces full structural validity
* The serializer enforces a minimal set of container-level semantic constraints that are required to preserve determinism and byte ownership:
  * OpaqueBytesPassthrough is permitted only within mdat
  * Raw byte box passthrough is permitted only for udta
* All other container semantic constraints (child sets, cardinality, ordering) are not yet enforced
* Some semantic constraints are **implicitly respected** by emitters and tests
* A small number of commit-path tests temporarily exercise size propagation using structures that are *structurally valid but semantically illegal*

This is tolerated **only** as a transitional measure.

Such tests are:

* narrowly scoped
* explicitly documented
* expected to be updated or removed once semantic validation is enforced

No production code may rely on semantically illegal structures.

---

### 4.8.4 Future Enforcement Rule

When semantic validation is added to the serializer:

* Illegal container contents must cause serialization to fail
* Tests that violate semantic rules must be corrected, not bypassed
* No test may weaken or disable serializer validation to pass

Semantic enforcement must be:

* centralized in the serializer
* explicit
* deterministic
* aligned with ISO BMFF and observed canonical layouts (e.g. ffmpeg output)

This evolution **tightens the contract** of NativeMuxer without changing its architecture.

---

### 4.8.5 Design Intent

The serializer is not a byte writer.

It is a **compiler backend** that validates both:

* *how* boxes are encoded
* *where* boxes are allowed to exist

Structural correctness ensures the file can be parsed.
Semantic correctness ensures the file is **meaningful and valid**.

Both are required for NativeMuxer’s determinism and correctness guarantees.

---

## 4.9 Assembly / Orchestration Layer (Structural Composition Only)

**Purpose**
Compose the outputs of existing architectural layers into a complete MP4 file.

The assembly layer is implemented as the compiler driver function
(compileMp4FromMp4Input).

It does not exist as a separate post-serialization phase.
Instead, it orchestrates the invocation of all architectural layers
in strict order and produces the final byte output.

**Responsibilities**

* Invoke existing derivation, layout, commit, and serialization components
* Wire outputs to inputs
* Assemble top-level MP4 structure (`ftyp`, `moov`, `mdat`)
* Produce final byte output

**Non-Responsibilities**

The assembly layer must not:

* derive semantic meaning
* calculate tables
* compute offsets
* inspect or mutate raw bytes
* apply policy
* infer structure

**Characteristics**

* Thin
* Deterministic
* Stateless
* Logic-free

All derivation, policy, layout, and serialization behavior must remain inside the previously defined layers.

**Rule**

> Assembly may only compose proven components.
> If logic cannot be tested in isolation, it does not belong here.

---

## 5. Box Tree DSL (Non-Negotiable)

### 5.1 Box Node

A valid box node **must** include:

```js
{
    type: "abcd"
}
```

Optional fields:

* `version`
* `flags`
* `flagBits`
* `body`
* `children`

Nothing else is permitted.

---

### 5.2 Body Fields

Allowed body field shapes:

```js
{ int: number }            // u32
{ short: number }          // u16
{ byte: number }           // u8

{ array: "byte"|"short"|"int", values: number[] }

{ type: "abcd" }           // literal FourCC

{ box: BoxNode }           // inline nested box

{ OpaqueBytesPassthrough: Uint8Array } // mdat only
```

Anything else is illegal.

---

### 5.3 Children

* `children` contains **only raw BoxNode objects**
* Wrapped boxes (`{ box: ... }`) are forbidden in children
* Children are serialized strictly after the body

---

## 6. Raw Bytes Rule (Critical)

### 6.1 Serializer-Owned Bytes

If bytes are part of MP4 structure:

* They **must** be expressed using:

  ```js
  { array: "byte", values: [...] }
  ```

Examples:

* `avcC` payload
* `ilst > data`
* codec configuration records

---


### 6.2 Opaque and Raw Bytes

The serializer distinguishes between two different raw byte mechanisms.

**1. Opaque body fields**

`OpaqueBytesPassthrough` is allowed **only** inside the body of:

```
mdat
```

This is used exclusively for media payloads.
No other box types may contain opaque body bytes.

**2. Raw box passthrough**

A box node may be represented as a fully opaque raw box using:

```
{ type: "udta", bytes: Uint8Array }
```

This form is allowed **only** for `udta`.

No other box type may be emitted as a raw byte box.

Any other use of raw bytes is a structural error.

---

## 7. Container Traversal Rule

All MP4 container traversal **must** go through:

```js
asContainer(bytes).enumerateChildren()
```

### Forbidden:

* Hardcoded child offsets
* Branching on box type strings
* Assuming 8-byte headers
* Manual cursor arithmetic outside container logic

This rule applies to:

* Readers
* Tests
* Inspectors

---

### 7.1 Track-Scoped Traversal (Multi-Trak Rule)

MP4 files may contain multiple `trak` boxes representing different media types
(e.g. video, audio).

Traversal that enters a `trak` container **must be explicit about which track
is being targeted**.

Rules:

* Traversal may not assume a single `trak`
* Traversal may not default to the "first" track
* Traversal must not infer track intent from downstream boxes

When traversal logic requires a specific track, the caller must explicitly
specify the desired handler type:

* `video` for video tracks
* `audio` for audio tracks

If a traversal path does **not** include `trak`, no track selector is required.

Examples:

* Valid paths without track selection:
  * `moov`
  * `ftyp`
  * `mdat`
  * `udta`

* Valid paths with explicit track selection:
  * `moov|trak[options.trackType = 'video']|mdia|minf|stbl`
  * `moov|trak[options.trackType = 'audio']|mdia|minf|stbl`

Attempting to traverse a `trak` without specifying the intended handler
is a structural error.

This rule exists to make ambiguous traversal states unrepresentable.

---

## 8. Tests as Contracts

Tests are not validation helpers.
They are **executable architectural specifications**.

Each structural unit has two tests:

1. **Structural Correctness**
2. **Locked Layout Equivalence**

### Locked Layout Equivalence Rules

* Child count must match
* Child order must match
* Child offsets must match
* Child bytes must match
* Parent size must match
* Full byte comparison is the final assertion

If any earlier assertion is removed, the test is incomplete.

In addition to box-level tests, NativeMuxer defines **compiler-pass tests**.
These tests validate:
* semantic derivation
* mdat assembly
* physical layout resolution
* commit correctness

A failure in a pass-level test indicates a **pipeline violation**, not a box bug.

---

## 9. Error Philosophy

NativeMuxer fails fast.

Errors are thrown when:

* Structure is missing
* DSL rules are violated
* Raw bytes appear where forbidden
* Container layout is ambiguous
* Serialization cannot be proven correct

Silent correction is forbidden.

Incompatible structural combinations are treated as errors.

Examples include (non-exhaustive):

* `avc1` SampleEntry under an audio (`audio`) track
* `mp4a` SampleEntry under a video (`video`) track
* Audio-only boxes queried from video tracks
* Video-only boxes queried from audio tracks

These errors are **structural misuse**, not missing feature support.

NativeMuxer prefers explicit failure over permissive guessing.

---

## 10. What NativeMuxer Does NOT Do

NativeMuxer does not:

* Encode video
* Decode video
* Interpret timestamps
* Infer structure
* Repair malformed MP4s
* Guess missing boxes
* Accept partial correctness

Those concerns belong elsewhere.

## 10.1 Known Architectural Gaps (Current)

The current architecture is deterministic and compiler-oriented, but two explicit gaps remain for large-output workflows:

1. Payload storage is memory-backed only.
   Media payloads are retained in memory and assembled into a monolithic `mdat` payload before final emission.

2. Offset emission is currently 32-bit (`stco`) only.
   A full 64-bit offset path (`co64`) is required for very large files.

These are implementation gaps, not conceptual contradictions.

---

## 11. Determinism Guarantee

Given:

* Identical semantic inputs
* Identical builder parameters
* Identical serializer

NativeMuxer will produce **bit-for-bit identical MP4 output**.

This is a required property.

---

## 12. Stability Contract

Once a box:

* passes locked-layout equivalence
* matches golden MP4 output

its emitter contracts are **frozen**


Changes require:

* explicit test updates
* explicit architectural justification
* no silent regression

---

## 13. Architectural Authority

This document supersedes:

* MUXER.md (historical)
* Inline commentary
* Ad-hoc design explanations

If code contradicts this document, **the code is wrong**.

---

## 14. End State

When NativeMuxer assembles:

```
ftyp + moov + mdat
```

into a final MP4 file, no **new architectural concepts** are required

That step is assembly, not design.

The architecture is already complete.

**Authority Model**

This document describes the current architectural contract of NativeMuxer
as proven by the test suite.

If a conflict exists between this document and executable tests,
the tests represent newer truth.

This document must be updated to reflect that truth.

## 14.1 Planned Evolution (Non-Breaking)

Future upgrades must preserve deterministic compiler behavior and the existing compiler boundary (`Mp4BuildInput` -> full MP4 bytes).

Planned architectural evolution:

1. Payload indirection via explicit payload references and pluggable payload stores.
   This allows memory-backed, browser-storage-backed, and filesystem-backed payload retention without changing semantic compilation rules.

2. Dual offset emission model with explicit `stco`/`co64` policy.
   Large-file paths must emit `co64` deterministically with full structural test coverage.

---

### Future Consideration: Path Selectors for MP4 Traversal

During audio track integration, a recurring source of complexity emerged around traversal boundaries, particularly where `trak`, `stsd`, and SampleEntry semantics intersect.

A possible future direction is to evolve the current string-based box paths into a **selector-style syntax** that makes structural intent explicit rather than inferred.

For example:

```
moov > trak[soun] > mdia > minf > stbl > stsd > sample(mp4a) > box(esds)
```

This approach would allow the selector itself to express:

* Which track is being targeted (e.g. `vide`, `soun`)
* When traversal enters a SampleEntry table
* When traversal returns to normal ISO box semantics

The motivation is not to generalize MP4 parsing, but to make ambiguous states unrepresentable and reduce implicit structural guessing inside traversal code.

This idea is exploratory and intentionally deferred. The current implementation remains path-based, with explicit track selection
and explicit SampleEntry boundaries enforced by the traversal API.
This concept may inform future refactors once the muxer and demuxer architecture has stabilized.
