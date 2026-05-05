## NativeMuxer Box Emitters: Semantic Ownership and Responsibility

### Purpose of This Document

This document defines how **box emitters** are classified and constrained within NativeMuxer.

It exists to make **semantic ownership explicit** at the point where MP4 structure is emitted, and to prevent accidental reinterpretation of data that NativeMuxer does not own.

This is a normative architectural document.
If code behavior contradicts this document, the code is wrong.

---

## Box Emitters: General Rules

Each file in `box-emitters/` emits exactly one MP4 box.

Box emitters are:

* pure
* deterministic
* stateless
* declarative

Emitters:

* do not derive meaning
* do not apply policy
* do not inspect MP4 container bytes
* do not compute offsets or sizes
* do not mutate inputs

Emitters describe **structure only**.

---

## Semantic Ownership Model

Not all MP4 boxes are owned semantically by NativeMuxer.

NativeMuxer distinguishes between boxes whose meaning it **owns and derives**, and boxes whose meaning is **declared or opaque** and must be preserved without interpretation.

This distinction is architectural, not stylistic.

---

## Category 1: Semantically-Owned Boxes

These boxes represent structure whose meaning is derived, validated, or enforced by the NativeMuxer compiler pipeline.

For semantically-owned boxes:

* Inputs originate from normalized semantic data
* Values are derived from samples, timing models, or policy
* The compiler is responsible for correctness
* Changes to emitter behavior imply changes to compiler semantics

Correctness is defined by:

* semantic equivalence
* structural validity
* deterministic layout

Examples include, but are not limited to:

* `stts` (time-to-sample)
* `stsc` (sample-to-chunk)
* `stsz` (sample sizes)
* `stco` / `co64` (chunk offsets)
* `stss` (sync samples)
* `mvhd`
* `tkhd`
* `mdhd`

Rules:

* These emitters must not accept opaque or uninterpreted data
* All values must be justifiable from compiler inputs
* If a value cannot be derived or validated, it does not belong here

---

## Category 2: Declared Metadata Boxes

These boxes represent metadata whose meaning is **not owned** by NativeMuxer.

For declared metadata boxes:

* Values are supplied by upstream systems (encoders, demuxers, tools)
* NativeMuxer does not infer, normalize, or reinterpret contents
* NativeMuxer is responsible only for:

  * correct box structure
  * correct placement
  * correct serialization

Correctness is defined as **non-interference**.

Examples include:

* `btrt` (bitrate hints)
* `pasp` (pixel aspect ratio)
* `avcC` (codec configuration record)
* `hvcC`
* `sgpd` / `sbgp` (sample grouping metadata)
* `mdta` (metadata item definitions)

Rules:

* Emitters must preserve declared values exactly
* Byte-for-byte equivalence against canonical output is required
* Any attempt to derive or reinterpret contents is an architectural violation

Declared metadata boxes are emitted because the MP4 specification requires them, not because NativeMuxer understands their meaning.

---

## Category 3: Opaque Container Payload Boxes

Some MP4 boxes are explicitly defined by the specification as opaque payload carriers.

For these boxes, NativeMuxer does not own *any* internal structure.

Correctness is defined strictly as byte preservation and correct containment.

### `udta` (User Data)

`udta` is treated as a fully opaque container payload.

Rules:

* NativeMuxer may emit `udta` only as a raw box passthrough
* NativeMuxer does not inspect or modify `udta` contents
* No structural assumptions are made about its children
* Correctness is byte-for-byte preservation

This is the only box type permitted to be emitted as a fully opaque raw box:

```js
{ type: "udta", bytes: Uint8Array }
```

Any other use of raw box passthrough is illegal.

### `mdat` (Media Data)

`mdat` is a special case of opaque payload handling.

Rules:

* Media payload bytes are opaque to NativeMuxer
* Opaque bytes may appear only as `OpaqueBytesPassthrough` fields
* Payload bytes must never be interpreted, transformed, or reordered

This exception exists solely to allow media data to pass through the compiler unchanged.

---

## Design Rule (Non-Negotiable)

If NativeMuxer cannot justify a value using:

* normalized semantic input,
* derivation logic,
* or explicit policy,

then that value is **not owned** by the compiler.

Such values must be treated as declared or opaque metadata and preserved exactly as supplied.

NativeMuxer must never invent meaning to appear helpful.

---

## Why This Matters

Most MP4 container bugs arise not from incorrect serialization, but from **ownership confusion**:

* interpreting metadata that should be preserved,
* normalizing values that were never derived,
* guessing intent that was never supplied.

NativeMuxer avoids these failures by enforcing a strict boundary between:

* what it owns and proves,
* and what it merely carries.

Box emitters are where that boundary becomes concrete.

Emitters must be boring.
Correctness comes from ownership discipline, not cleverness.
