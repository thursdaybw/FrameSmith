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

**This is the story.**
