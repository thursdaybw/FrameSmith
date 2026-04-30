# NativeMuxer Design Evolution

This document records the **actual path** by which NativeMuxer came into existence.

It exists to:

* preserve architectural intent,
* prevent future regressions,
* explain *why* certain rules are non-negotiable,
* and capture the moment where abstraction stopped being theory and became necessity.

This is not a plan.
This is not a roadmap.
This is not aspirational.

This is what happened.

---

## 0. Context

NativeMuxer did **not** begin as a standalone project.

It emerged under pressure from Framesmith’s MVP requirements:

* browser-only execution,
* WebCodecs output,
* deterministic exports,
* and real-world playback validation.

At the time, the working assumption was:

> “We can rely on an external MP4 muxer.”

That assumption did not survive contact with reality.

---

## 1. Initial State: External Muxers as Infrastructure

### 1.1 MP4Box.js

MP4Box.js was adopted early because:

* it existed,
* it ran in the browser,
* it appeared to accept encoded samples.

However, practical use revealed structural misalignment:

* MP4Box.js assumes ownership of the encoding pipeline
* It infers structure rather than enforcing it
* Its APIs blur semantic intent and binary layout
* Validation failures occur deep inside the library
* Correctness becomes opaque and un-debuggable

The system stopped being *designed* and started being *negotiated with*.

This violated Clean Architecture.

---

### 1.2 Mediabunny

Mediabunny appeared promising because:

* it exposed a high-level MP4 authoring API,
* it handled ISO BMFF internally,
* it shipped as ES modules.

However, Mediabunny revealed a deeper problem:

* It is not a muxer
* It is a pipeline framework
* It enforces invariants that assume its own encoder
* It rejects externally produced WebCodecs chunks
* Fixing one assertion exposed another

The library assumed authority over semantics it did not own.

At this point, the conclusion became unavoidable.

---

## 2. Architectural Inflection Point

The decisive realization was this:

> **Framesmith does not need a “smart” muxer.
> It needs a deterministic compiler.**

Once that framing clicked, every subsequent decision became obvious.

* MP4 is not dynamic
* MP4 structure is fixed
* MP4 rules are mechanical
* MP4 correctness is provable

Therefore:

> **The muxer must be built, not integrated.**

---

## 3. Early NativeMuxer: Structural Walking

The first NativeMuxer iterations focused on:

* walking MP4 boxes,
* extracting children,
* learning offsets,
* understanding FullBox vs SimpleBox layouts.

At this stage:

* assumptions were common,
* offsets were occasionally hardcoded,
* traversal logic leaked everywhere.

This phase was necessary but unstable.

The system *worked*, but correctness was accidental.

---

## 4. Container Model Emergence

Repeated traversal bugs led to a critical rule:

> **Traversal semantics belong to the container, not the caller.**

This directly produced:

* `asContainer(bytes)`
* `enumerateChildren()`
* centralized child-offset detection

Once this abstraction existed:

* offset bugs stopped appearing,
* FullBox vs SimpleBox ceased to matter,
* traversal logic vanished from readers and tests.

This was the first *irreversible* design commitment.

---

## 5. Readers vs Builders Split

The next pressure point was semantic reconstruction.

Early attempts mixed:

* byte slicing,
* semantic interpretation,
* and box construction.

This collapsed under complexity.

The correction was a strict separation:

### Readers

* extract meaning
* never emit bytes
* never fabricate structure

### Builders

* construct structure
* never parse MP4s
* never accept raw bytes

This separation eliminated:

* fake boxes,
* passthrough hacks,
* structural ambiguity.

From this point onward, **every box gained a reader and a builder**.

No exceptions.

---

## 6. Serializer as a Compiler, Not a Writer

Initially, serialization was permissive.

That proved fatal.

Silent acceptance of malformed structures:

* hid bugs,
* allowed illegal layouts,
* made tests meaningless.

The serializer was redefined as:

> **A validating compiler for MP4 structure.**

This led to:

* a strict DSL,
* explicit body vs children distinction,
* rejection of raw bytes outside `mdat`,
* early failure instead of corrupted output.

At this moment, the architecture locked.

---

## 7. Locked Layout Equivalence

The most important evolution was methodological.

Instead of asking:

> “Does this play?”

The system began asking:

> “Is this identical?”

Golden MP4s from ffmpeg became the reference.
Every box was tested for:

* structure,
* child ordering,
* offsets,
* size,
* full byte equivalence.

This transformed development from experimentation into proof.

---

## 8. udta / meta / ilst: The Final Trial

Metadata boxes forced the last architectural correction.

They exposed:

* the temptation to passthrough bytes,
* the urge to “just copy payloads”,
* the danger of violating DSL ownership.

The serializer rejected these attempts.
Correctly.

The only viable solution was:

* full semantic readers,
* full structural builders,
* zero shortcuts.

When `udta → meta → ilst → data` passed locked-layout equivalence, the architecture was complete.

No further rules were needed.

---

## 9. Relationship to Framesmith

NativeMuxer is **not** Framesmith architecture.

It is a **subsystem with its own law**.

Framesmith:

* orchestrates pipelines,
* manages rendering,
* owns time and composition.

NativeMuxer:

* compiles structure,
* enforces invariants,
* produces containers.

This separation is intentional and permanent.

---

## 10. Why MUXER.md Exists

`MUXER.md` is a snapshot of intent.

It reflects:

* early assumptions,
* subsystem plans,
* future-facing optimism.

It is valuable historically.

It is no longer authoritative.

NativeMuxer.Architecture.md is the law.
This document explains how that law came to be.

---

## 11. End Condition

The design evolution is **not complete** until:

```
ftyp + moov + mdat
```

are assembled into a final MP4 file.

However:

> **That remaining work is assembly, not design.**

The architecture will not change.
No new abstractions are required.
No new rules are needed.

The system has crossed the point of no return.

---

## 12. Why This Document Matters

Future developers will ask:

* Why is the serializer so strict?
* Why can’t we pass raw bytes?
* Why does every box need a reader?
* Why is traversal centralized?
* Why is this “over-engineered”?

This document answers those questions **once**.

So the system never regresses.

---

## 13. From Passes to a Compiler

Up to this point, NativeMuxer existed as a **set of proven passes**.

Each pass was:

* independently testable,
* locally correct,
* and architecturally constrained.

What did *not* yet exist was inevitability.

The system still *felt* like:

* a collection of emitters and a serializer,
* assembled manually in tests,
* with “final assembly” treated as an external concern.

That perception did not survive contact with reality.

---

### 13.1 The Golden Oracle as a Temporary Contract

The first attempts at end-to-end compilation were driven by a practical shortcut:

> If a value can be extracted from a known-good MP4,
> then it can serve as a compiler input.

Golden MP4s produced by ffmpeg acted as an **oracle of correctness**.

From them, it was possible to extract:

* timescales,
* durations,
* table shapes,
* and structural facts sufficient to drive emitters.

For a time, this appeared viable.

The compiler contract was implicitly shaped by:

* “what can be observed in an existing MP4”
* rather than “what a real client can supply”

This was expedient, but unstable.

---

### 13.2 The WebCodecs Constraint Broke the Illusion

As `compileMp4FromMp4Input` began to take shape, a deeper problem emerged.

The *real* client of NativeMuxer is not ffmpeg.
It is a system that:

* talks to WebCodecs,
* receives encoded chunks,
* and requires a muxer to speak on its behalf.

That client **cannot**:

* derive MP4 tables,
* normalize timing models,
* infer representational choices,
* or reverse-engineer container semantics.

Those responsibilities do not belong at the boundary.

This exposed a hard rule:

> If an input cannot be supplied directly from WebCodecs output
> without modification, then it does not belong in the public compiler contract.

At that moment, the golden oracle stopped being a valid source of truth for inputs.

It could validate outputs.
It could not define the interface.

---

### 13.3 Normalization Moved Inward

Once this rule was accepted, the architecture shifted decisively.

Responsibilities that had been *implicitly external* were pulled **into the compiler**:

* normalization of semantic inputs
* derivation of timing and size tables
* policy decisions where representation was ambiguous
* adaptation into emitter-ready structures

This was not an expansion of scope.
It was a correction of ownership.

The client’s job became minimal and mechanical:

* supply encoded samples,
* supply declared intent,
* supply nothing inferred.

Everything else became compiler responsibility.

---

### 13.4 Derivers and Policies Revealed Themselves

With normalization and derivation internalized, something unexpected happened:

New passes did not need to be invented.
They revealed themselves.

Each time an assumption was removed from the client boundary:

* a deriver became necessary,
* a policy decision surfaced,
* an adapter boundary clarified.

These were not speculative abstractions.
They were **forced by the constraints**.

The compiler pipeline stopped being planned and started being *discovered*.

---

### 13.5 compileMp4FromMp4Input Was Not an Invention

When the end-to-end compilation function finally emerged, it did not introduce new ideas.

It did not:

* invent derivation,
* invent policy,
* invent structure,
* or invent layout.

It merely:

* sequenced already-proven passes,
* respected their contracts,
* and produced final bytes.

This was not creative design work.

It was the formal acknowledgment that the compiler already existed.

---

### 13.6 The Moment of Inevitability

The decisive realization was this:

> Once all assumptions are removed from the client boundary,
> the compiler must do everything else.

At that point:

* NativeMuxer ceased to be “a set of tools”
* the pipeline ceased to be aspirational
* and assembly ceased to be architectural work

What remained was composition.

If the remaining work can be expressed entirely as composition,
then the architecture is complete.

From this moment onward:

* changes could only be additive,
* extensions could only be orthogonal,
* and corrections could only occur within existing passes.

The system had crossed the point of no return.

---

This section exists to record **when NativeMuxer stopped being shaped by convenience and became shaped by inevitability**.

From here on, NativeMuxer is not negotiated.
It is compiled.

---

## 14. Recent Evolution Snapshot (February 14, 2026)

This section records the latest architecture-relevant movement since the
previous major update.

### 14.1 `co64` moved from theory to partial implementation

`co64` support progressed materially:

* schema and emitter wiring were added
* extractor/emitter agreement tests were added
* locked-layout byte equivalence for `co64` leaf emission was proven against
  an FFmpeg oracle

This is real progress, but not full completion.

### 14.2 Compiler policy remains `stco`-only

The compile pipeline still resolves chunk offsets to `stco` in final output.
`co64` is not yet selected by compiler policy.

So current state is:

* `co64` primitive support: yes
* compiler-level `stco/co64` decision: not yet
* end-to-end `co64` compile guarantee: not yet

### 14.3 Test realism improved

Earlier behavior could make browser runs look greener than they were for large
`co64` oracles.

Current policy is explicit:

* browser marks node-only `co64` tests as `SKIP`
* node runs the authoritative `co64` checks

This preserves signal quality while still validating real FFmpeg-backed `co64`
paths.
