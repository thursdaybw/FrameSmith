## NativeMuxer: Scope and Use Cases

### What NativeMuxer Is

NativeMuxer is a **deterministic MP4 assembly engine**.

It is not an encoder.
It is not a decoder.
It is not an MP4 parser.

NativeMuxer takes **semantic media data** and emits a standards-compliant MP4 file with full control over structure, layout, and byte-level correctness.

---

### Core Input Contract

NativeMuxer operates on **meaning**, not discovery.

Its inputs are:

* Encoded media samples

  ```js
  {
    bytes: Uint8Array,
    timestamp: number,
    duration: number,
    isKey: boolean
  }
  ```

* Codec configuration (e.g. avcC payload)

* Track metadata (timescale, dimensions, handler type)

* Muxing policy (chunking, ordering, interleaving)

NativeMuxer does not care where these inputs originate.

---

## Supported and Intended Use Cases

### 1. WebCodecs → MP4 (Browser-Native Encoding)

NativeMuxer integrates naturally with WebCodecs:

* `EncodedVideoChunk` → samples
* `VideoEncoderConfig.description` → avcC
* No ffmpeg required
* Fully in-browser MP4 generation

This is the original motivation for the project.

---

### 2. Demux → Remux (No Re-encoding)

NativeMuxer can repackage existing MP4 files by:

* Extracting samples and codec configuration
* Rebuilding container structure deterministically
* Emitting a new MP4 without touching media bytes

This enables:

* Trimming
* Reordering
* Re-chunking
* Metadata repair
* Layout normalization
* Fast-start optimization
* Fragmented → flat MP4 conversion

No encoding involved.
No generational loss.

This turns NativeMuxer into a **media transformation engine**, not just an encoder companion.

---

### 3. Encoder-Agnostic Integration

NativeMuxer can accept output from:

* WebCodecs
* WASM-compiled encoders (x264, ffmpeg)
* Hardware encoders
* Server-side pipelines

As long as samples and codec configuration are supplied, NativeMuxer can package them.

---

### 4. Server-Side and Edge Usage

Because NativeMuxer:

* Has no DOM dependencies
* Uses only typed arrays
* Is deterministic and side-effect free

It can run in:

* Node.js
* Deno
* Bun
* Serverless and edge environments

This enables backend video processing without shelling out to ffmpeg.

---

### 5. Automated Editing Pipelines

NativeMuxer is suitable for automated media workflows, such as:

* Podcast auto-editing
* Silence-based cutting
* Multi-camera switching
* AI-driven editing decisions
* Programmatic timeline assembly

By separating **policy** (editing decisions) from **assembly** (container construction), complex logic can be layered safely without risking container corruption.

---

### 6. Educational and Diagnostic Use

Because the system is:

* Explicit
* Test-driven
* Byte-accurate
* Readable

NativeMuxer can serve as:

* A reference implementation
* A debugging tool
* A teaching aid for MP4 internals
* A correctness oracle for container structure

---

### Platform Scope and Portability

NativeMuxer is browser-native, but not browser-bound.

It runs anywhere JavaScript runs, including desktop browsers, mobile app runtimes, server-side environments, and embedded JavaScript engines. NativeMuxer does not depend on DOM APIs, build tools, or framework-specific assumptions.

NativeMuxer does not care how media is encoded. As long as encoded samples and codec configuration are supplied, it can deterministically assemble a correct MP4 file.

For a deeper discussion of mobile, embedded, and non-browser usage, see WHY-NATIVE-MUXER.md.

---

## What NativeMuxer Explicitly Does Not Do

NativeMuxer does not:

* Parse MP4 files generically
* Infer timestamps or semantics
* Decode codecs
* Inspect NAL units
* Guess layout or policy
* Perform discovery

All intent must be explicit.

This is not a limitation.
It is the design.

---

## Why This Architecture Matters

By enforcing strict boundaries:

* Meaning is separated from bytes
* Policy is separated from structure
* Layout is resolved only when all information is known

NativeMuxer avoids the three classic MP4 failure modes:

1. Incorrect offsets
2. Semantic drift
3. Undebuggable byte diffs

What emerges is not just correctness, but **leverage**.

---

## Where the Time Goes (and Why This Is Fast)

NativeMuxer separates **encoding time** from **muxing time**.

In traditional media pipelines, these two steps are tightly coupled.  
In NativeMuxer, they are intentionally decoupled.

### Typical Streaming-Oriented Tooling

Most muxers are designed to work *while media is still arriving*.

That means they must:

* commit timing incrementally
* update tables as samples arrive
* buffer and rewrite container structures
* maintain a valid file state at all times

As a result, muxing is not free. It becomes an ongoing process with real overhead.

### NativeMuxer’s Model

NativeMuxer assumes a different workflow:

1. Encode all samples first
2. Collect all semantic facts
3. Derive structure once
4. Emit the MP4 file in a single pass

Because all information is known up front:

* no incremental patching is required
* no tables are rewritten
* no offsets are guessed and fixed later

Muxing becomes a **pure memory operation**.

### Practical Performance Comparison

| Stage | Streaming Muxers | NativeMuxer |
|------|------------------|-------------|
| Encoding | Dominant cost | Dominant cost (same) |
| Muxing | Noticeable overhead | Near-zero overhead |
| Re-muxing | Expensive | Extremely cheap |
| Retiming | Hard / requires re-encode | Trivial |
| Re-export | Often re-encode | No re-encode |

In practice, NativeMuxer’s muxing time is approximately:

```
O(n) over mdat size
```

Bound almost entirely by memory bandwidth.

For videos up to hours long, muxing time is typically **milliseconds to seconds**, not minutes.

### The Key Architectural Difference

Muxing does not have to be tied to time.

Traditional tools tie muxing to *media arrival*.

NativeMuxer ties muxing to **semantic completeness**.

That single decision is what makes non-linear, deterministic, and fast exports possible.

---

## Why NativeMuxer Is Different

NativeMuxer exists because most media tooling optimizes for *playback success*, not for *engineering certainty*.

Traditional tools discover structure from bytes, infer intent, normalize layouts, and silently rewrite data. That works until it does not, and when it fails, debugging becomes guesswork.

NativeMuxer takes the opposite approach.

It requires intent to be explicit, treats bytes as owned data with clear boundaries, and resolves layout deterministically. The result is not just correctness, but leverage.

---

### Transmuxing and Correctness

NativeMuxer is intentionally **not** a fully lossless, opaque transmuxer.

It acts as a **deterministic MP4 compiler**:

* Container structures defined by the MP4 specification are validated, normalized, and emitted correctly.
* Payloads that are explicitly arbitrary by spec (such as `udta` user data and media samples) are preserved verbatim.
* Unsupported or ambiguous structures are rejected rather than guessed.

If you need a tool that preserves every byte regardless of correctness, general-purpose tools like ffmpeg or MP4Box are a better fit.

If you need deterministic structure, explicit policy, and byte-level correctness where the spec defines it, NativeMuxer is designed for that job.

---

If you want an even *tighter* version (3–4 lines max), say the word and I’ll compress it further.

---

## Practical Benefits

### Deterministic Output You Can Trust

Given the same inputs, NativeMuxer always produces the same MP4 bytes.

There is no hidden state, no environment-dependent behavior, and no “almost identical” output. This makes it possible to:

* snapshot-test MP4 files
* diff output meaningfully
* reason about changes with confidence
* refactor without fear of silent regressions

Most media tools ask “does it play?”
NativeMuxer asks “is it exactly what we intended?”

---

### Byte-Level Correctness Without Byte-Level Thinking

NativeMuxer guarantees byte-for-byte correctness without forcing you to think in offsets, hex dumps, or magic constants.

You work in terms of:

* samples
* timestamps
* durations
* semantic parameters

The system derives:

* table entries
* offsets
* sizes
* layout

When something breaks, tests fail at the semantic level, not at “byte 84321”. This dramatically reduces debugging time and cognitive load.

---

### Zero Accidental Media Corruption

NativeMuxer never mutates what it does not own.

* sample bytes are passed through verbatim
* codec configuration blobs are preserved exactly
* opaque payloads remain opaque

This prevents an entire class of failures where files decode on one player but not another, or “mostly work” until production.

If bytes change, it is intentional and visible.

---

### Safe Demux → Transform → Remux Workflows

NativeMuxer enables true remuxing without re-encoding.

You can:

* extract samples and codec configuration
* cut, reorder, or regroup media
* emit a new MP4
* preserve quality perfectly

There is no generational loss, no codec drift, and no dependency on ffmpeg internals. This turns NativeMuxer into a reliable media transformation engine, not just an encoder companion.

---

### Explicit Control Over Structure and Policy

NativeMuxer separates **policy** from **structure**.

You control:

* chunking strategy
* ordering rules
* interleaving decisions
* layout intent

The muxer never guesses.

This makes it possible to experiment with layout, implement fast-start optimization deliberately, and build higher-level editing logic without risking container corruption.

Policy is explicit.
Structure is derived.

---

### Tests That Match How Containers Actually Fail

NativeMuxer is designed to be tested the way MP4 files actually break.

Tests assert:

* semantic equivalence
* structural correctness
* locked-layout equivalence
* opaque payload preservation

Failures point to a violated assumption, not to a vague playback issue.

Instead of “it plays in Chrome but not Safari”, you get actionable failures that explain *why* the container is wrong.

---

### Runs Everywhere JavaScript Runs

Because NativeMuxer has:

* no native dependencies
* no DOM assumptions
* no system calls
* only typed arrays and plain objects

It runs unchanged in:

* browsers
* Node.js
* server-side pipelines
* serverless and edge environments

The same code path can be used for client-side recording, backend processing, automated workflows, and diagnostics.

---

## Zero-Build Integration (Plain JavaScript by Design)

NativeMuxer is written in plain, standards-compliant JavaScript.

There is no TypeScript compilation step.
There is no bundler requirement.
There is no build pipeline.

You can:

* check out the repository
* import the modules
* run the code

That is the entire setup.

---

### Why This Matters

Build systems introduce friction, even when they work:

* tooling overhead
* configuration drift
* onboarding cost
* opaque failure modes

NativeMuxer avoids that entirely.

This has practical consequences:

* instant adoption
* accurate stack traces
* direct debugging
* no mismatch between source and runtime
* long-term maintainability without toolchain rot

What you read is what runs.

For a system where byte-level correctness matters, removing hidden transformations is not convenience, it is safety.

---

## Known Limitation: Monolithic MDAT Assembly

In its current form, NativeMuxer assembles the entire `mdat` payload as a single `Uint8Array` before writing the file.

This means:

* the full media payload is held in memory
* offsets are resolved after all samples are present
* `stco` offsets are finalized in one pass

For the intended use cases (browser-based editing, offline export, batch processing), this is acceptable and intentional.

### Why This Is Not a Dead End

The project is explicitly architected to allow this to evolve.

Because:

* payload assembly is isolated
* layout resolution is a separate pass
* offset commitment is explicit

It is straightforward to extend NativeMuxer to support:

* chunked MDAT writing
* streaming or windowed payload emission
* late `stco` finalization
* large-file and low-memory scenarios

This is an **engineering trade-off**, not a structural limitation.

The architecture already supports the extension point.

---

## In Summary

NativeMuxer’s value is not speed or novelty.

Its value is **control without fragility**.

It lets you treat MP4 assembly as a deterministic, inspectable compilation step rather than an opaque side effect of media tooling.

That is what makes it different.
That is what makes it useful.
That is why it exists.
