# NativeMuxer Architecture

A deterministic, dependency-free MP4 muxer designed for browser environments and WebCodecs output.

This document defines the **current architectural truth** of the NativeMuxer.
It is not historical.
It does not explain how decisions were reached.
It describes what **is**, what **must remain**, and what **is forbidden**.

All NativeMuxer code, tests, and future changes are governed by this document.

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
[moov]
[mdat]
```

No alternative ordering is permitted.

---

## 4. Architectural Boundaries

NativeMuxer is composed of **three distinct layers**, each with strict responsibilities.

### 4.1 Semantic Layer (Readers)

**Purpose**
Extract semantic meaning from reference MP4 structures.

**Characteristics**

* Read-only
* Never emit bytes
* Never construct box trees
* Never assume layout
* Use container traversal exclusively

**Examples**

* `readMvhdForBuild`
* `readTrakForBuild`
* `readUdtaForBuild`
* `readMetaForBuild`
* `readIlstForBuild`

**Rules**

* Readers accept **whole MP4 files**, not partial boxes
* Readers return **semantic objects**, never raw box bytes
* Readers must not fabricate structure
* Readers must fail loudly if structure is missing

---

### 4.2 Structural Layer (Box Builders)

**Purpose**
Construct declarative MP4 box trees.

**Characteristics**

* Deterministic
* Stateless
* Pure functions
* Declarative output

**Output Shape**

Each builder returns a **BoxNode**:

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

**Rules**

* Builders never accept raw bytes
* Builders never parse existing MP4s
* Builders express structure only
* Builders do not serialize

Each MP4 box has exactly one builder.

---

### 4.3 Serialization Layer (Compiler)

**Purpose**
Compile a validated box tree into bytes.

**Characteristics**

* Validating
* Strict
* Non-heuristic
* Byte-exact

The serializer enforces the MP4 DSL and rejects illegal structures.

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

### 6.2 Opaque Bytes

`OpaqueBytesPassthrough` is allowed **only** for:

```
mdat
```

No exceptions.

Any attempt to pass raw bytes into:

* `udta`
* `meta`
* `ilst`
* `data`
* any non-mdat box

is a structural error.

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

its builder and reader contracts are **frozen**.

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

into a final MP4 file, **no architectural changes are required**.

That step is assembly, not design.

The architecture is already complete.

---

**This document is the law.**
