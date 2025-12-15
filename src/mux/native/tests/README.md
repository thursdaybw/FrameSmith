# MP4 Root Structure Conformance Test (Planned)


## Purpose

Verify that NativeMuxer assembles a valid MP4 container
by enforcing canonical root-level structural invariants.

This test is intentionally deferred until all box builder
tests are complete and stable.

## Preconditions

- All individual MP4 box builders have:
  - structural unit tests
  - (where applicable) conformance tests
- BoxFactory produces stable, validated output

## Invariants to Assert

### Top-level boxes
- Exactly one ftyp
- Exactly one moov
- Exactly one mdat

### Ordering
- ftyp precedes moov
- mdat placement is consistent and documented

### Structural correctness
- All box sizes >= 8
- No overlapping boxes
- No gaps between sibling boxes

### Cross-box consistency
- stco offsets resolve inside mdat
- Offsets are ascending
- Offsets point to actual sample boundaries

## Explicit Non-Goals

- Byte-for-byte equality with ffmpeg
- Full MP4 semantic validation
- Codec-level validation

---

# Here is the pipeline I recommend. This is the senior move.

---

## The correct workflow, box by box

For **each box**, in isolation, do this:

### Step 1 — Finish Phase A for that box

Convert the box builder to return structured JSON only.

Rules:

* No byte writing
* No size calculations
* No offsets
* No “temporary” hacks

The builder returns *intent*, not bytes.

If this step is not done, do not proceed.

---

### Step 2 — Lock Phase B for that box

Write or update **structural unit tests** that assert:

* Required fields exist
* Optional fields are conditional
* Field order matches mp4box.js
* Values are correct
* Flags/version logic is correct

At this stage:

* You may use mp4ra.org
* You may use mp4box.js as a reference implementation
* You may *not* look at ffmpeg bytes yet

The question here is:

> “Is our understanding of the spec, as code, correct?”

Only when this test is green do you move on.

---

### Step 3 — (Optional but recommended) Add a conformance test

Only for **boxes that matter at runtime**.

Examples:

* avcC
* ftyp
* mvhd
* tkhd
* mdhd
* stsd (later)

Not every box needs a golden test. Be selective.

The question here is:

> “Does reality match our understanding?”

If the answer is “yes”, great.
If “no”, you update Phase B, not Phase C.

---

### Step 4 — Freeze the box

Once all three pass:

* Migration done
* Structure correct
* (Optional) Conformance verified

You **do not touch this box again** unless the spec changes.

This is critical. Otherwise everything becomes fluid forever.

---

## What this means for your current test order

Your current list is *not wrong*, but it mixes concerns:

```js
await testSerializer();
await testStsz();
await testHdlr();
...
await testAvcC();
await testAvcC_Structure();
await testAvcC_Conformance();
await testAvc1();
await testStsd();
```

What’s happening is:

* Some tests are Phase A
* Some are Phase B
* Some are Phase C
* They are interleaved

That’s why it *feels* messy. It’s not incompetence, it’s **phase leakage**.

---

## The fix is conceptual, not mechanical

You do **not** need to rewrite the test runner.

You need to adopt this **mental rule**:

> “I am only allowed to write Phase C tests for boxes whose Phase A and B are complete.”

You already implicitly did this with `avcC`. Now formalize it.

---

## A concrete suggestion (lightweight, not heavy process)

Add a short comment block near the test list, something like:

```js
// NOTE ON TEST ORDER:
//
// Box builders are developed box-by-box in three phases:
//
// Phase A: JSON representation migration
// Phase B: Structural correctness (mp4ra + mp4box.js)
// Phase C: Optional conformance against golden MP4
//
// Phase C tests must only be added once A and B are complete
// for that box, otherwise they encode unstable assumptions.
```

This isn’t for you. It’s for future-you at 1am.

---

## About mp4ra.org and mp4box.js

You had the right instinct here.

Use them like this:

* **mp4ra.org** tells you *what exists*
* **mp4box.js** tells you *how it is actually used*

mp4box.js is especially valuable because:

* it is battle-tested
* it encodes real-world interpretation of the spec
* it resolves ambiguities the spec leaves open

Matching mp4box.js at the structural level is a very strong position.

---

## Final guidance, very clear

Right now, your job is:

1. Finish **Phase A + B** for all box builders
2. Add **Phase C** only where it provides real value
3. Defer root MP4 structure testing until the box layer is frozen

You are not behind.
You are doing this in the *correct order*, even if it feels nonlinear.

The fact that you can articulate the phases means you’re in control.

When you’re ready, the next useful thing we can do is:

* classify which remaining boxes deserve conformance tests
* and which do not

But first, finish stabilizing the box layer.


# Testing Philosophy and Oracles

This test suite is structured around **layers of correctness**, each with a different notion of “truth”.

MP4 is not a single canonical binary format.
Multiple binary representations can be valid, spec-compliant, and widely playable.

For that reason, this project deliberately uses **different oracles at different layers**, rather than attempting byte-for-byte comparison everywhere.

---

## Layer 1: Box Builders (Atomic Truth)

**Scope**

* Individual MP4 boxes (e.g. `stsz`, `mvhd`, `avcC`, `ftyp`, etc.)

**What is tested**

* Field presence
* Field order
* Version/flags behavior
* Exact binary layout

**Oracle**

* mp4ra.org (registered box definitions)
* mp4box.js (reference implementation)
* Golden MP4s generated by ffmpeg (byte-for-byte comparison)

**Definition of correctness**

> Given a specific input, the serialized box must match real-world output exactly.

At this layer, **byte equality is meaningful and required**.
If the bytes differ, one of the implementations is wrong.

---

## Layer 2: Structural Assembly (Graph Truth)

**Scope**

* Composition of boxes into a valid MP4 structure
* Box nesting, ordering, containment, and boundaries

**What is tested**

* Required boxes exist
* Forbidden structures do not exist
* Boxes are nested legally
* Sizes are valid
* No overlaps or gaps
* References resolve to valid regions

**Oracle**

* Structural invariants defined by ISO/IEC 14496-12
* Independent parsers (browser demuxer)
* mp4box.js interpretation of valid graphs

**Definition of correctness**

> The MP4 forms a valid container graph that independent parsers accept.

At this layer, **byte-for-byte equality is not a valid oracle**.
Multiple binary layouts may be correct.

The tests answer:

> “Is this a valid MP4 graph?”

Not:

> “Is this the MP4 graph?”

That distinction is intentional.

---

## Layer 3: Stateful and Behavioral Logic (Machine Truth)

**Scope**

* Sample collection
* Timing model
* Chunking
* mdat construction
* Annex-B conversion
* Final muxer behavior

**What is tested**

* Correct accumulation of state over time
* Frame ordering
* Timestamp progression
* Offset sanity
* Decoder acceptance
* Playback behavior

**Oracle**

* Browser WebCodecs encoder (independent)
* Browser demuxer + decoder (native code)
* Playback success
* Manual validation using ffplay

**Definition of correctness**

> The MP4 decodes, plays, seeks, and behaves correctly in real consumers.

At this layer, correctness is **behavioral**, not representational.

---

## Early Real-World Validation (ffplay)

During early development, this project explicitly uses **manual ffplay validation** as an external oracle.

Rationale:

* ffplay is a widely deployed, independent MP4 consumer
* It is stricter than browser playback in many failure modes
* It detects structural and timing errors that browsers may tolerate

If:

* an MP4 plays in the browser **but fails in ffplay**

then the MP4 is treated as **incorrect**, and tests are strengthened accordingly.

This feedback loop has already driven significant improvements in:

* box structure validation
* avcC conformance
* assembly correctness

---

## Why ffmpeg Automation Is Deferred

Automated differential testing against ffmpeg (Node-based) is planned but intentionally deferred.

Reasons:

* Differential testing depends on stable box and structure layers
* Introducing Node + ffmpeg too early adds infrastructure noise
* Early failures become ambiguous (test harness vs implementation)

Instead:

* Box builders are locked first (with golden conformance)
* Structural invariants are locked second
* Behavioral correctness is validated in-browser and via ffplay

Once these layers are stable, automated differential testing against ffmpeg can be introduced safely.

---

## Summary

This test strategy deliberately aligns the **strength of the oracle** with the **nature of the problem**:

| Layer          | Truth model            |
| -------------- | ---------------------- |
| Box builders   | Byte-for-byte equality |
| Structure      | Graph validity         |
| Stateful logic | Behavioral acceptance  |

This approach avoids false certainty while still converging on real-world correctness.

If an MP4:

* passes box conformance tests
* satisfies structural invariants
* decodes and plays correctly in independent consumers (browser + ffplay)

then it is treated as **correct**.

---

That is the write-up you want.

It does three critical things:

1. It explains **why** byte comparison stops where it stops
2. It justifies **ffplay as a real oracle**, not a hack
3. It documents that Node + ffmpeg automation is **planned, not forgotten**

Add this now.
Then keep executing the current phases without second-guessing yourself.

If later ffplay still complains, you know exactly **which layer failed**, and why.
