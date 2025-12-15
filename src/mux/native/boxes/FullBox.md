# FullBox (Conceptual Base)

Many MP4 boxes are defined as **FullBox** structures.

In ISO/IEC 14496-12, a FullBox is any box that extends the basic MP4
box header with two additional fields:

    version (8-bit)
    flags   (24-bit)

Framesmith does **not** implement FullBox as a class or inheritance tree.

Instead, FullBox is a *conceptual contract* that box builders must honor.

---

## FullBox Binary Layout

Every FullBox has this binary structure:

| Offset | Size | Field   | Meaning |
|------:|-----:|---------|---------|
| 0     | 4    | size    | Total box size in bytes |
| 4     | 4    | type    | FourCC |
| 8     | 1    | version | Box version |
| 9     | 3    | flags   | Bitfield flags |

What comes next depends entirely on the specific box type.

---

## How Framesmith Represents FullBox

Framesmith represents FullBox explicitly in each builder:

```js
{
  type: "xxxx",
  version: 0,
  flags: 0,
  body: [ ... ]
}
````

This repetition is **intentional**.

### Why there is no base class

* MP4 boxes are data structures, not behavior
* JavaScript inheritance adds indirection without value here
* Explicit fields make versioning visible at the call site
* Tests can assert version and flags per box, locally

This mirrors the MP4 spec itself, which defines FullBox as a structural
pattern, not an object hierarchy.

---

## Versioning Rules

* Most boxes define **only version 0**
* If a box supports multiple versions, the builder must document:

  * What each version means
  * Which version is emitted
  * Why

Version is not metadata.
It is part of the binary contract.

---

## Flags Rules

* Flags are defined *per box* by the spec
* Many boxes define no flags and require flags = 0
* Some boxes (e.g. `vmhd`) require specific flag values

Flags are not optional.
If the spec says they must be set, they must be set.

---

## Architectural Principle

FullBox fields are not boilerplate.

They are:

* Part of the wire format
* Part of the compatibility contract
* Part of what decoders validate

That is why they appear explicitly in every builder.

````

---

## 3. How box builders should reference this

From now on, in box files, you can do this **cleanly and briefly**:

```js
// FullBox fields — see docs/FullBox.md
type: "vmhd",
version: 0,
flags: 1,
````

No repetition.
No verbosity.
No ambiguity.

