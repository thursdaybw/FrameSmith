# Golden Truth Extractor Contract 

This directory defines **test-only box readers** used to extract
structural truth and builder input from MP4 boxes.

Golden truth extractors are **not free functions**.
They are **capabilities registered into a controlled registry** and
are only accessible via a single abstraction: `getGoldenTruthBox`.

---

## Purpose

Modules in this directory exist for **one reason only**:

> **Read truth from MP4 box bytes and return:**
>
> - full structural fields (for inspection)
> - the exact input object required by the corresponding builder


They do **not** build boxes.
They do **not** assemble trees.
They do **not** encode policy.
They do **not** perform navigation on their own.

They answer two explicit questions:

> *“What fields does this box contain?”*  
> *“What input object is required to rebuild this box?”*

---

## Scope

All golden truth extractors in this directory:

* operate in **tests only**
* are **read-only**
* support:
  * structural inspection
  * semantic equivalence tests
  * locked-layout equivalence tests

They are **not part of the production muxer**.

---

## Architectural Boundary (Critical)

Golden truth extractors are **never called directly**.

All access to golden truth extractor behavior **must go through**:

```

getGoldenTruthBox.fromMp4(mp4Bytes, path)
getGoldenTruthBox.fromBox(boxBytes, path)

```

There are **no other legal entry points**.

If code imports a golden truth extractor module and calls a function directly,
that code is **invalid** by definition.

---

## Golden truth extractor Capabilities

Each golden truth extractor exposes **exactly two capabilities**:

```

readFields(boxBytes)
getBuilderInput(boxBytes)

```

### `readFields`

Returns **full structural truth** about the box:

* counts
* entries
* fixed-point values
* raw bytes (for byte-level comparison only)

Used for:
* inspection
* diagnostics
* field-level conformance tests

### `getBuilderInput`

Returns **exactly the input object required by the corresponding builder**.

* no defaults
* no normalization
* no policy
* no layout decisions

Used for:
* calling builders
* round-trip rebuild tests

---

## Registration Model

Golden truth extractors are **registered explicitly** in `golden truth extractors/index.js`.

Each golden truth extractor module exports a single installer function:

```

register<Box>Golden truth extractor

```

Example:

```

registerSttsGolden truth extractor(register)

```

The installer **must** register both capabilities:

```

register({
readFields(fn),
getBuilderInput(fn)
})

```

A golden truth extractor that does not provide **both** capabilities is invalid.

---

## Identity and Routing

Golden truth extractors are identified by **full MP4 path**, not box type alone.

Example:

```

moov/trak/mdia/minf/stbl/stts
moov/udta/meta/hdlr
moov/trak/mdia/hdlr

```

This avoids ambiguity and allows structurally distinct boxes
with the same FourCC to coexist safely.

---

## Naming Conventions

Inside a golden truth extractor module:

* Capability functions must be named clearly and explicitly
* Suffix `FromBoxBytes` is mandatory

Examples:

```

readSttsBoxFieldsFromBoxBytes
getSttsBuilderInputFromBoxBytes

```

Names must describe **exactly** what the function does.
No abbreviations. No overloaded meanings.

---

## Input Contract

Golden truth extractors:

* accept **only box bytes** (`Uint8Array`)
* assume the box has already been isolated
* perform **no traversal**
* perform **no path resolution**

Navigation is the responsibility of `getGoldenTruthBox.fromMp4`.

---

## Output Contract

Allowed return values:

* numbers
* strings
* arrays
* plain objects
* `Uint8Array` only when semantically opaque (e.g. codec payloads)

Forbidden return values:

* implicitly assembled box nodes
* container structures
* child arrays
* serialized output
* layout offsets
* computed policy

---

## Forbidden Behavior (Non-Negotiable)

A golden truth extractor must **never**:

* locate itself inside an MP4
* call `extractBoxByPathFromMp4`
* call a builder
* assemble a container
* rebuild a subtree
* serialize anything
* infer or enforce policy
* hide composition logic

If a golden truth extractor does any of the above, it is **not a truth extractor**.

---

## Relationship to Builders

The relationship is strictly one-way:

```

Box bytes
→ Golden truth extractor (readFields / getBuilderInput)
→ BuilderInput 
→ Builder
→ Box node

```

Golden truth extractors extract truth.  
Builders construct structure.

There is no overlap.

---

## Where Composition Lives

**Composition lives only in tests.**

Tests may:

* navigate MP4s
* read multiple boxes
* wire builder inputs explicitly
* assemble trees intentionally

Golden truth extractors must **never** perform composition on behalf of tests.

---

## Design Principle

This system exists to make tests:

* honest
* explicit
* uncheatable
* semantically meaningful

If a golden truth extractor makes a test *shorter* by hiding intent,
it is doing the wrong thing.

---

## Litmus Test

A golden truth extractor is valid **only if**:

> A test author can clearly see:
>
> - what builder input is being rebuilt
> - why the rebuilt bytes should match the reference

If intent is hidden, the contract is broken.

---

This document is the boundary.

If future code feels tempted to cross it, the correct action is **not**
to bend the rules, but to make the intent explicit in the test.

That is the point.
