# ✅ **We update the tests FIRST so that they reflect the new world.

Then we run them and watch them GO RED.
Then we implement the migration plan step-by-step until they GO GREEN.**

This is textbook TDD for a large architectural refactor.

Let me explain the reasoning cleanly and concretely, in Uncle Bob mode:

---

# ⭐ WHY WE UPDATE TESTS FIRST

Right now, the tests assume:

* every box builder returns `Uint8Array`
* moov and stbl structures are byte-level arrays
* tests manually parse bytes immediately after build

But after the migration:

* each box builder will return a **BoxNode**
* `serializeBoxTree` produces bytes only at the final stage

So your tests must reflect the **desired architecture**, not the current architecture.

If we don’t update the tests first, this will happen:

* we migrate stsz → returns node
* tests still expect bytes
* we patch box factory wrappers
* tests remain “accidentally green”
* nothing proves the new system works end-to-end
* the test suite is lying to us

**Updating tests first ensures the system tells the truth.**

---

# ⭐ WHAT TESTS WE UPDATE

We do NOT update all tests.
We update the ones at the correct layers.

Here is the correct TDD layering strategy:

---

## **Layer 1 – Leaf box tests (stsz, stts, stsc, stco, avcC, avc1, stsd)**

These tests must be updated to:

### ✔ expect a BoxNode instead of bytes

### ✔ use `serializeBoxTree(node)` to get bytes for assertions

This preserves *all* behavior but moves the serialization responsibility.

**These tests go red immediately** because you haven’t migrated anything yet.

Then we follow the step-by-step plan:

* migrate stsz
* fix tests → green
* migrate stts
* fix tests → green
* migrate stsc
* green
* migrate stco
* green
* migrate stsd
* green

**This gives you a trustable test suite while migrating.**

---

## **Layer 2 – Container box tests (stbl, minf, mdia, trak, moov)**

These tests get updated the same way:

### ✔ they expect a BoxNode

### ✔ they serialize at the end

These will go red when leaf boxes migrate (expected).

Then, after each container migration:

* stbl node test → green
* minf node test → green
* mdia node test → green
* trak node test → green
* moov node test → green

---

## **Layer 3 – Integration tests (test_mp4_structure, internal_integrity)**

These tests **continue parsing MP4 bytes**, unchanged.

But:

### ✔ NativeMuxer.finalize() now calls serializeBoxTree(moovNode)

So the integration tests remain byte-level and continue validating:

* offsets
* sample table correctness
* moov/mdat ordering
* stco & stsz consistency
* nal prefix correctness

These tests DO NOT change.
They are your **contract tests**.
They prove your final MP4 is still correct.

---

# ⭐ EXACT MIGRATION ORDER FOR THE TEST SUITE

Here is the clean, safe sequence:

---

## **STEP A — Update leaf-box tests (stsz, stts, stsc, stco, stsd)**

Modify each test to:

```js
const node = buildStszBox(...);
const bytes = serializeBoxTree(node);
assert(...) // on bytes
```

At this moment:

### ✔ All leaf tests go RED

### ✔ That’s what we want

Because we have not migrated builders yet.

---

## **STEP B — Migrate 1 leaf box (stsz) to nodes**

Run only:

```
test_stsz.js
```

Make it green.

This verifies:

* new node builder works
* serializer stub handles stsz
* round-trip is correct
* no mutations
* correctness is preserved

---

## **STEP C — Repeat for stts, stsc, stco, stsd**

Update test → red
Migrate builder → green

Your confidence skyrockets with each one.

---

## **STEP D — Update container tests (stbl, minf, mdia, trak, moov)**

Again:

* update expected interface → red
* migrate builder → green

---

## **STEP E — Fix any temporary wrappers**

As more boxes return nodes, fewer wrappers are required.

Eventually:

* BoxFactory returns only nodes
* NativeMuxer will call `serializeBoxTree()` once
* All tests will be green

---

## **STEP F — Run integration tests**

Expect:

* many will still be green (because byte-bytes didn’t change)
* the ones that fail reveal real structural issues early

This is where you verify:

* STBL is correctly nested
* DINF contains DREF
* offsets are correct
* sizes match
* NAL length prefix correctness

---

# ⭐ FINAL STATE OF THE SYSTEM

By doing the test updates FIRST:

You get a **test-driven refactor** that reveals bugs *before* they spread, makes each migration fully validated, and ensures you are never flying blind.

The tests enforce the new architecture.

The tests define the new reality.

The code evolves safely under their supervision.

---

# Unified Node Schema

Here is the **clean, minimal, universal node schema** that allows you to serialize *every* MP4 box with a single serializer, no branches, no God Object, fully Open Closed.

This is the schema that all box builders will produce.

It is deliberately small, declarative, composable, and sufficient for every ISO BMFF box you need for MP4.

---

# ✅ UNIFIED NODE SCHEMA

A box node is a **plain JavaScript object**:

```js
{
    type: "xxxx",           // 4-character MP4 box type
    version: 0,             // optional (default 0)
    flags: 0,               // optional (default 0)
    body: [ ... ],          // ordered list of fields
    children: [ ... ]       // optional, array of box nodes
}
```

Everything below lives inside `body`.

A body is an **ordered list of declarative field descriptors**.

---

# 🌱 FIELD TYPES (DEFINITIVE LIST)

These are the only primitives the serializer needs to understand.

Each is a small, declarative descriptor the serializer can size and write.

## 1. Unsigned 32 bit

```js
{ u32: number }
```

## 2. Signed 32 bit

```js
{ i32: number }
```

## 3. 16-bit values

```js
{ u16: number }
{ i16: number }
```

## 4. 8-bit values

```js
{ u8: number }
{ i8: number }
```

## 5. Big-endian fixed-point values (rare, but common in mvhd, tkhd matrices)

```js
{ fixed1616: number }   // 16.16 fixed point
{ fixed88: number }     // 8.8 fixed point
```

## 6. 4-character code (fourcc)

```js
{ type: "vide" }   // writes 76, 105, 100, 101
```

(This is separate from the box's own `type`.)

## 7. String of known length

```js
{ str: "abc" }
```

(Serializer pads or truncates to fit field's expected width.)

## 8. Raw bytes

```js
{ bytes: Uint8Array }
```

## 9. Array of uniform numeric values

Used for stsz, stsc, stco, etc.

```js
{ array: "u32", values: [5, 10, 15] }
```

Supported array types: `"u8"`, `"u16"`, `"u32"`.

## 10. Tables (repeated rows of a fixed structure)

Example for stts:

```js
{
    table: {
        fields: [
            { u32: "count" },
            { u32: "duration" }
        ],
        rows: [
            { count: 3, duration: 1000 },
            { count: 1, duration: 1000 }
        ]
    }
}
```

The serializer walks each row and emits fields in order.

## 11. Embedded child box

If you want to inline a nested box inside a parent:

```js
{ box: childNode }
```

But normally nested boxes go in `children`, not in the body.

---

# 🧱 EXAMPLE: stsz Node Using Unified Schema

```js
{
    type: "stsz",
    version: 0,
    flags: 0,
    body: [
        { u32: 0 },                   // sample_size
        { u32: entries.length },
        { array: "u32", values: entries }
    ]
}
```

---

# 🧱 EXAMPLE: stts Node

```js
{
    type: "stts",
    version: 0,
    flags: 0,
    body: [
        { u32: entries.length },
        {
            table: {
                fields: [
                    { u32: "count" },
                    { u32: "duration" }
                ],
                rows: entries
            }
        }
    ]
}
```

---

# 🧱 EXAMPLE: mdia Node (with children)

```js
{
    type: "mdia",
    body: [],
    children: [
        mdhdNode,
        hdlrNode,
        minfNode
    ]
}
```

---

# 🧱 EXAMPLE: Full tkhd Node with matrices

```js
{
    type: "tkhd",
    version: 0,
    flags: 0x000007,
    body: [
        { u32: creationTime },
        { u32: modificationTime },
        { u32: trackId },
        { u32: 0 },                    // reserved
        { u32: duration },
        { u32: 0 }, { u32: 0 },        // reserved 2x
        { u16: layer },
        { u16: alternateGroup },
        { u16: volume },
        { u16: 0 },
        { fixed1616: 1 }, { fixed1616: 0 }, { fixed1616: 0 },   // Matrix
        { fixed1616: 0 }, { fixed1616: 1 }, { fixed1616: 0 },
        { fixed1616: 0 }, { fixed1616: 0 }, { fixed1616: 1 },
        { fixed1616: width },
        { fixed1616: height }
    ]
}
```

---

# 🔥 Why This Schema Works

1. **Serializer is universal**
   Handles fields in order, recursively.

2. **Builders are tiny**
   Their only job is to fill out nodes.

3. **Open Closed Principle**
   Adding a new box does not require touching serializer.

4. **Perfect for testing**
   Tests can assert nodes before serialization.

5. **MP4 spec alignment**
   Field order matches ISO BMFF.

6. **Zero God Object**
   No branching on box types.
   No multiplexing logic inside serializer.

---

# Incremental Migration Plan

Here is the **incremental migration plan** — the safest, smallest-surface, lowest-risk way to convert your entire MP4 builder system into a clean *BoxNode → Serializer* architecture **without breaking anything**, **without touching everything at once**, and **without losing a single existing file**.

This is the plan a senior engineer would execute in a real production refactor.

I’m writing this as **Uncle Bob**: clear, procedural, minimal, composable, and reversible.

---

# ✅ **INCREMENTAL MIGRATION PLAN**

A clean 7-step sequence where each step compiles, each step passes tests, and nothing explodes.

---

# **STEP 0 — Add the New Serialization Layer (No Integration Yet)**

Create:

```
src/mux/native/serializer/serializeBoxTree.js
```

Inside it, add three empty stubs:

```js
export function computeBoxSize(node) {
    throw new Error("computeBoxSize not implemented");
}

export function writeBox(node, buffer, offset) {
    throw new Error("writeBox not implemented");
}

export function serializeBoxTree(node) {
    const size = computeBoxSize(node);
    const out = new Uint8Array(size);
    writeBox(node, out, 0);
    return out;
}
```

**This file is not used yet.
Your system remains unchanged.**

---

# **STEP 1 — Convert ONE Box Builder (stsz) to Node Mode**

Modify only `buildStszBox`:

Before:

```js
return Uint8Array(...)
```

After:

```js
return {
    type: "stsz",
    version: 0,
    flags: 0,
    sampleSize: 0,
    entries: sampleSizes.slice(),
};
```

**DO NOT integrate serialization yet.**

**DO NOT modify any other builder.**

**DO NOT modify moovBox.js.**

The rest of the system still expects Uint8Array, so this will break — but we fix that *without touching the rest of the architecture*:

### Add a temporary compatibility wrapper:

In `BoxFactory.js`:

```js
import { buildStszBox as _buildStszNode } from "./boxes/stszBox.js";
import { serializeBoxTree } from "./serializer/serializeBoxTree.js";

function buildStszBox(...args) {
    const node = _buildStszNode(...args);
    return serializeBoxTree(node);  // convert node → bytes
}

export const BoxFactory = {
    ...
    stsz: buildStszBox,
    ...
};
```

### Outcome

* stsz builder now uses the new system
* system still outputs bytes
* no other box is affected
* tests still run

**You have migrated your first box.**

---

# **STEP 2 — Update Serializer Until stsz Round-Trips Correctly**

Implement just enough of `serializeBoxTree` to handle stsz:

* compute size
* write header
* write count
* write entries

Run only:

```
test_stsz.js
```

Nothing else.

This is the smallest possible migration boundary.

---

# **STEP 3 — Migrate stts, stsc, stco One by One**

For each leaf box:

### 1. Change the builder to return a node:

Example (stts):

```js
return {
    type: "stts",
    version: 0,
    flags: 0,
    entries: [
        { sampleCount, sampleDuration }
    ]
};
```

### 2. Update BoxFactory to serialize it:

```js
function buildSttsBox(...args) {
    const node = _buildSttsNode(...args);
    return serializeBoxTree(node);
}
```

### 3. Implement its serialization logic

Extend the serializer with handlers:

```js
switch (node.type) {
    case "stts": ...
    case "stsc": ...
    case "stco": ...
}
```

### 4. Run the unit tests for that one file

Nothing else.

### Migration order:

1. `stsz` (done)
2. `stts`
3. `stsc`
4. `stco`

When all four serialize correctly, you have a complete STBL set.

---

# **STEP 4 — Migrate stsd Last (Because It Has Nesting)**

stsd includes:

* sample description count
* avc1
* avcC

This is the only slightly more complex leaf node.

But by this point you already have full confidence in your serializer.

Serialization implementation:

* stsd writes header + entry count
* serializes child sample description(s)
* avc1 serializes its fields + nested avcC

This step gives you:

**the entire stbl subtree now fully node-powered.**

---

# **STEP 5 — Migrate the Container Boxes (minf, mdia, trak, moov)**

Do them in order of depth.

### Convert `moovBox.js` to return:

```js
return {
    type: "moov",
    children: [
        mvhdNode,
        trakNode
    ]
};
```

Same for:

* `trak`
* `mdia`
* `minf`
* `stbl`

### Then extend serializer to:

* compute container sizes
* write type + size
* recurse into children
* append child data

At this point the entire MP4 is generated from a **pure object tree**.

---

# **STEP 6 — Replace stco offset patching logic with Node-Model Computation**

This is where things get *way* easier.

Instead of:

* serialize partial moov
* measure size
* calculate offsets
* rebuild stco

You will:

1. Generate the **node tree**
2. Call a function that walks the node tree computing offsets
3. Fill `stco.entries` accordingly
4. Serialize once

**Zero mutation.
Zero corruption.
Zero double-serialize.**

---

# **STEP 7 — Remove Temporary Compatibility Wrappers**

When every box builder returns a node:

* delete the per-box wrapper
* BoxFactory becomes pure nodes
* only NativeMuxer calls `serializeBoxTree()` once at the end

---

# **STEP 8 — Update test_utils.js**

Right now tests expect `buildStszBox` to return bytes.

Instead, make test utils serialize nodes internally.

This is a 5-line change.

---

# **STEP 9 — Delete Old Byte-Level Builders**

Once fully migrated:

* remove old byte-writing code
* remove individual write functions from box builders
* remove duplicate offset + size logic

Your code becomes:

* **clean**
* **declarative**
* **pure**
* **testable**
* **deterministic**
* **immune to mutation bugs**

---

# 💎 FINAL RESULT

At the end of this plan, you have:

### ✔ A clean, pure, JSON-like representation of your MP4

### ✔ A single authoritative serializer

### ✔ Zero duplication across builders

### ✔ Perfect visibility into structure

### ✔ No mutation, ever

### ✔ No tangled size propagation

### ✔ Perfect debugging

This is exactly how a world-class MP4 builder or compiler backend is structured.

It is *not* a redesign.
It is a **refinement**.

---
