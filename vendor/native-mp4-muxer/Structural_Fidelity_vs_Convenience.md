### **Structural Fidelity vs Convenience: Why NativeMuxer Is Architected Differently**

### 1. Purpose of This Document

This document explains **why NativeMuxer’s architecture differs fundamentally** from most existing MP4 parsers and muxers, and why those differences are **intentional, justified, and necessary** for its goals.

It is not an attack on other systems.
It is not a claim of superiority by default.
It is an explanation of **architectural trade-offs and guarantees**.

---

### 2. The Shared Surface Reality

NativeMuxer and existing MP4 systems appear similar on the surface:

* They parse MP4 files
* They emit MP4 files
* They can support playback
* They handle standard ISO BMFF structures

From the outside, they seem interchangeable.

They are not.

---

### 3. The Core Architectural Divergence

The divergence is not in features.
It is in **what the system promises to preserve**.

| Dimension                   | NativeMuxer           | Typical MP4 Libraries         |
| --------------------------- | --------------------- | ----------------------------- |
| Structural identity         | Preserved exactly     | Often normalized or discarded |
| Byte-for-byte round trip    | Guaranteed            | Not guaranteed                |
| Unknown box handling        | Preserved             | Often dropped                 |
| Canonical path identity     | Enforced              | Usually absent                |
| Parsing strictness          | Explicit and testable | Forgiving and implicit        |
| Traversal vs interpretation | Separated             | Often collapsed               |

This is not an implementation detail.
It is a **philosophical commitment**.

---

### 4. Why Other Systems Collapse Layers

Most MP4 libraries collapse traversal and interpretation early.
This is not accidental.

They are optimized for:

* Streaming playback
* Incremental parsing
* Mutation tolerance
* Editing workflows that regenerate structure
* Operating in native memory with mutable buffers

In those environments:

* Structural loss is acceptable
* Canonical identity is unnecessary
* Reversibility is not required
* “Plays video” is the success metric

These are **valid incentives**, but they produce **different architectures**.

---

### 5. NativeMuxer’s Different First-Class Invariant

NativeMuxer makes one invariant non-negotiable:

> **Structural truth must be preserved as a first-class property.**

That means:

* Every box exists because it existed
* Every byte can be re-emitted
* Every traversal is explicit
* Every interpretation is opt-in
* No layer silently decides meaning

This invariant is what enables:

* Deterministic editing
* Verifiable transformations
* Lossless demux → mux cycles
* Stable registry paths
* Architectural composability

---

### 6. SampleEntry as the Fault Line

The SampleEntry refactor surfaced this divergence clearly.

In most systems:

* SampleEntries are parsed, normalized, and forgotten
* Child traversal and semantic interpretation are merged
* Header irregularities are abstracted away early

In NativeMuxer:

* SampleEntries are treated as **structural anomalies**
* Traversal is isolated from interpretation
* Raw bytes are preserved
* Codec semantics live strictly at the leaves

This is why constructs like **SampleEntryCursor** exist.

Not because they are clever.
Because pretending SampleEntries are ISO boxes is architecturally false.

---

### 7. Addressing Common Objections

**“What about streaming?”**
Streaming requires incremental parsing.
That is an *adapter concern*, not a core violation.

**“What about editing?”**
Editing requires mutation policy.
Policy belongs *above* structure, not inside it.

**“What about performance?”**
Performance trade-offs are policy choices.
Structural honesty does not preclude optimization.

**“This is more strict than necessary.”**
Strictness is how invariants are enforced.
Relaxation can be layered. Loss cannot be undone.

---

### 8. Capability Comparison (Truthful Framing)

| Capability              | NativeMuxer | Typical Libraries |
| ----------------------- | ----------- | ----------------- |
| Play video              | Yes         | Yes               |
| Round-trip bytes        | Yes         | No                |
| Structural verification | Yes         | Rarely            |
| Incremental parsing     | Not core    | Often             |
| Mutation tolerance      | Explicit    | Implicit          |
| Deterministic output    | Yes         | Often no          |

This is not a “scorecard”.
It is a **guarantee matrix**.

---

### 9. The Key Conclusion

NativeMuxer is not “better” because it has more features.

It is stronger because:

* It preserves information others discard
* It encodes guarantees others assume
* It separates concerns others conflate
* It makes loss explicit rather than silent

Anything NativeMuxer does not yet support is a **policy decision**, not a structural limitation.

---

### 10. Why This Matters in the Browser

The browser is a hostile environment for:

* Native memory tricks
* Mutable global state
* Silent side effects
* Hidden normalization

NativeMuxer’s architecture aligns naturally with:

* Immutable data
* Explicit transformation
* Deterministic behavior
* Verifiable output

This is not accidental.
It is the consequence of choosing structural truth over convenience.

---

### 11. Final Statement

> NativeMuxer does not reject existing MP4 architectures.
> It refuses their compromises.

That refusal is the entire point.
