# NativeMuxer Compiler Pipeline
## Pass Contracts, Invariants, and Direction of Travel

⚠️ NON-NORMATIVE BUT AUTHORITATIVE

This document is not the architectural law of NativeMuxer.
That authority lives in:

  docs/NativeMuxer.Architecture.md

This document defines the **compiler pipeline as a set of immutable pass
contracts**:

- what each pass consumes
- what each pass produces
- what each pass is forbidden from doing
- and why those constraints exist

It exists to prevent architectural drift by making the **direction of travel**
and **pass responsibilities** explicit.

If code violates a pass contract described here, the code is wrong.

---

## Purpose of This Document

NativeMuxer is a **compiler**, not a streaming system and not a convenience API.

Correctness is achieved by:

- strictly ordered compiler passes
- one-directional data flow
- explicit representation changes
- early validation
- late commitment

This document answers one question only:

> “What are the compiler passes, and what is each one allowed to do?”

It does not describe:
- design history (see DesignEvolution.md)
- architectural law (see Architecture.md)
- test mechanics
- future features

---

## Compiler Model (Normative Direction of Travel)

NativeMuxer operates as a **strict, linear compiler pipeline**.

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
→ final assembly
```

No pass may:
- infer missing information
- inspect representations it does not own
- peek ahead to later passes
- repair or “fix” upstream output

---

## Pass 0: Semantic Input Validation
### (External to the Compiler Core)

**Purpose**

Ensure that incoming semantic input is complete, explicit, and unambiguous
before compilation begins.

**Inputs**

- `Mp4BuildInput`
- semantic samples
- declared build parameters

**Outputs**

- validated semantic input
- no derived meaning
- no structure
- no bytes

**Forbidden**

- MP4 container knowledge
- policy decisions
- defaults or inference

This pass defines the **closed-world grammar** of NativeMuxer inputs.

---

## Pass 1: Normalization
### (Semantic → Semantic)

**Purpose**

Normalize semantic inputs into a complete, explicit internal representation.

**Responsibilities**

- normalize timing units
- normalize sample shapes
- enforce required semantic fields
- eliminate ambiguity

**Produces**

- normalized semantic data
- no MP4 tables
- no structure
- no bytes

**Forbidden**

- MP4 box knowledge
- offsets or sizes
- policy decisions
- byte access

After this pass, downstream stages may assume **nothing is missing**.

---

## Pass 2: Derivation
### (Semantic → Semantic)

**Purpose**

Derive MP4-relevant semantic meaning from normalized samples.

This pass answers:
> “What does the media *mean*?”

**Derives (semantic form only)**

- time-to-sample meaning (STTS)
- sample size meaning (STSZ)
- sample-to-chunk meaning (STSC)
- sync sample meaning (STSS)
- provisional chunk offsets (mdat-relative only)

**Produces**

- derived semantic tables
- no MP4 structure
- no bytes
- no file offsets

**Forbidden**

- box knowledge
- serialization
- size computation
- absolute offsets

This pass is pure, deterministic, and representation-agnostic.

---

## Pass 3: Policy Application
### (Semantic → Semantic)

**Purpose**

Apply **explicit, testable decisions** where multiple valid MP4 representations
exist for the same semantic meaning.

**Examples**

- movie timescale selection
- edit list decisions
- optional container inclusion (udta, meta)
- representational choices that do not invent semantics

**Produces**

- new semantic facts
- no structure
- no bytes

**Forbidden**

- derivation
- MP4 box emission
- serialization
- inference of missing input

Policy exists only where choice is unavoidable.
All policy must be explicit and test-covered.

---

## Pass 4: Adapter Normalization
### (Semantic → Structural Parameters)

**Purpose**

Adapt derived semantic meaning into **emitter-ready parameter objects**.

This pass defines the **hard boundary** between meaning and structure.

**Responsibilities**

- validate derived semantics
- normalize shapes
- enforce current representational constraints
- produce explicit emitter contracts

**Produces**

- immutable emitter parameter objects
- no MP4 structure
- no bytes
- no layout decisions

**Forbidden**

- serialization
- offsets or sizes
- policy decisions
- MP4 traversal

Emitters must accept **only** these parameter objects.

---

## Pass 5: Structural Emission
### (Parameters → Declarative Structure)

**Purpose**

Emit declarative MP4 structure from fully resolved inputs.

**Responsibilities**

- produce BoxNode trees
- express structure only
- conform to the Box Tree DSL

**Produces**

- declarative MP4 box graphs
- no offsets
- no sizes
- no bytes

**Forbidden**

- derivation
- policy
- byte inspection
- offset computation
- serialization

Each MP4 box has exactly one emitter.

---

## Pass 6: Physical Layout Resolution
### (Structure → Committed Structure)

**Purpose**

Resolve absolute file layout once all structure is known.

This is the **only pass** where file offsets exist.

**Responsibilities**

- fix top-level box ordering
- compute absolute box offsets
- determine mdat header size
- finalize STCO values

**Produces**

- committed structural representation
- layout-dependent tables
- no bytes written

**Forbidden**

- serialization
- semantic derivation
- policy decisions
- mutation of meaning

No box may know its own offset prior to this pass.

---

## Pass 7: Serialization
### (Structure → Bytes)

**Purpose**

Validate and serialize declarative structure into a deterministic byte stream.

**Responsibilities**

- enforce the Box Tree DSL
- reject ambiguous or illegal structures
- compute box sizes
- emit bytes deterministically

**Produces**

- serialized byte arrays
- no mutation of structure

**Forbidden**

- policy
- semantic inference
- structure repair

The serializer is a **compiler backend**, not a permissive writer.

---

## Pass 8: Final Assembly
### (Bytes → File)

**Purpose**

Compose already-finalized byte sequences into a complete MP4 file.

**Responsibilities**

- invoke serialization
- concatenate byte arrays
- respect resolved box order
- return final output

**Produces**

- a single `Uint8Array` MP4 file

**Forbidden**

- derivation
- policy
- layout computation
- structure mutation
- conditional logic beyond composition

If this pass needs to “think”, the design is already broken.

---

## Orchestration

The compiler is driven by a **thin orchestration layer**.

This layer:

- sequences the passes
- wires outputs to inputs
- contains no logic of its own

It is not a compiler pass.

It must remain boring.

---

## Directional Guarantees

Across all passes:

- data flows forward only
- representation ownership is explicit
- earlier passes never depend on later ones
- failures are localized and diagnosable

Violating these guarantees re-introduces heuristic behavior and ambiguity.

---

## Final Invariant

Once NativeMuxer reaches:

```
ftyp + moov + mdat
```

no new architectural concepts are required.

Future work extends the pipeline.
It does not correct it.
