# NativeMuxer

A deterministic, browser-native MP4 muxer for **non-linear video workflows**.

NativeMuxer exists because existing browser media tools are built for **streaming**, not for **editing**.

If you are building a browser-based video editor, captioning tool, or any system that needs to *decide timing and structure after the fact*, NativeMuxer fills a gap that other libraries do not.

### NativeMuxer Is Intentionally Not a Fully Lossless Transmuxer

NativeMuxer does **not** attempt to preserve every byte of every MP4 file indiscriminately.

That is a deliberate design choice.

General-purpose transmuxers treat MP4 files as largely opaque and aim to preserve unknown structures verbatim. This maximizes byte-level fidelity, but it also means broken or ambiguous container structures are carried forward silently.

NativeMuxer takes a different approach.

NativeMuxer acts as a **deterministic MP4 compiler**:

* Structures that are **normative and well-defined by the MP4 specification** are validated, normalized, and re-emitted correctly.
* Structures that are **explicitly arbitrary by the specification** (such as `udta` user data) are preserved verbatim.
* Structures that are **unsupported, ambiguous, or outside the compiler’s IR** are rejected rather than guessed.

In practical terms, this means:

> If you transmux with NativeMuxer, you do not just move bytes.
> You get a *correct* MP4 file.

NativeMuxer may restructure container data where the specification defines correctness. It will never silently rewrite or discard data it does not own, and it will never preserve broken structure without making that decision explicit.

If you need a tool that preserves every byte regardless of correctness, tools like ffmpeg or MP4Box are more appropriate.

If you need a tool that guarantees deterministic structure, explicit policy, and byte-level correctness where the spec defines it, NativeMuxer is designed for that job.

---

## The problem NativeMuxer solves

Most browser media tools assume this workflow:

1. Frames arrive
2. You encode them
3. You mux them immediately
4. The file is finished

That works for:

* recording
* live streaming
* format conversion

It does **not** work well for:

* video editing
* captions and animated overlays
* retiming
* re-exporting without re-encoding

NativeMuxer is built for a different reality:

> Sometimes you only know how a video should be structured **after** all frames are rendered and encoded.


## Encoding Is the Bottleneck — and That Is Correct

In a NativeMuxer-based pipeline, encoding is almost always the slowest step.

That is not a flaw.

It is a direct consequence of separating concerns correctly.

NativeMuxer performs no decoding, no analysis, and no incremental state repair.  
Once encoded samples exist, MP4 assembly is a fast, deterministic memory operation.

This has practical consequences:

* exporting a 1-minute video is much faster than real time
* exporting a 1-hour video is still dominated by encoding, not muxing
* re-exporting without re-encoding is nearly instantaneous

Traditional tools often blur this distinction by mixing encoding and muxing into a single streaming process.

NativeMuxer makes the cost model explicit:

> Encoding is expensive.  
> Muxing does not have to be.

---

## Streaming vs file-centric workflows

### Streaming-centric tools (mp4box.js, Media Bunny, mux.js)

These tools are excellent at what they are designed for:

* accepting encoded frames *as they arrive*
* buffering internally
* deciding timing and chunking on the fly
* emitting MP4 data progressively

In practice, this means:

* timestamps are committed early
* chunking decisions are made automatically
* once a frame is written, it is “baked in”

This is ideal for:

* live capture
* transcoding
* transmuxing
* real-time pipelines

But it becomes restrictive when you want to **edit**.

---

### File-centric workflows (what NativeMuxer enables)

NativeMuxer assumes a different flow:

1. Render and encode **all** frames
2. Collect **all** encoded samples
3. Decide timing, structure, and layout **once everything is known**
4. Write the MP4 file deterministically

In this model:

* meaning comes first
* bytes come last

This is how non-linear editors work.

---

## Integration Friction in Existing Media Libraries

Before NativeMuxer existed, several existing libraries were evaluated, including:

- ffmpeg.wasm
- mp4box.js
- Media Bunny

All of them are capable tools.
All of them solve real problems.
None of them integrated cleanly into a render-graph-based video editor.

This was not a feature gap.
It was an architectural one.

### A shared pattern across existing tools

Despite their differences, these libraries share a common assumption:

> They expect to *own the media pipeline*.

In practice, this means they tend to:

- manage their own lifecycles
- control when bytes are written
- commit timing decisions incrementally
- maintain internal mutable state
- assume they are the “driver” of the process

That model works well when the tool *is* the application.

It breaks down when the tool is expected to be a **small, composable stage** inside a larger system.

### Render graphs demand different properties

A render-graph-based editor already has:

- explicit stages
- explicit data ownership
- late-bound decisions
- deterministic recomputation
- clear boundaries between rendering, encoding, and muxing

In that environment, a muxer must be:

- stateless or explicitly state-driven
- callable as a pure step
- tolerant of being “last”
- able to accept *finished* data
- non-opinionated about flow control

None of the evaluated tools were designed around those constraints.

### Where the friction showed up

The integration failures were consistent:

- APIs assumed streaming input rather than completed sample sets
- lifecycle management leaked into the host system
- timing and structure were committed too early
- tooling assumptions (bundlers, environments, globals) leaked upward
- adapting the editor to the tool became easier than adapting the tool to the editor

At that point, the tool stops being a library and starts being a framework.

That is the line that could not be crossed.

### NativeMuxer’s design response

NativeMuxer was designed by inverting those assumptions.

It does not:

- manage rendering
- manage encoding
- manage time flow
- maintain hidden state
- assume control of execution

Instead, it:

1. accepts explicit, finished semantic inputs
2. derives structure deterministically
3. emits a final MP4 as a pure result

This makes it possible to embed NativeMuxer as a *leaf node* in a render graph rather than as a controlling system.

The individual sections below explain how this mismatch appears in specific tools.

---

## Why existing tools didn’t fit

### mp4box.js

mp4box.js is excellent at:

* parsing MP4 files
* modifying existing MP4s
* streaming encoded data into an MP4 structure

But when used as a muxer, it:

* requires streaming input
* manages internal state and lifecycles
* commits timing and structure incrementally
* hides intermediate decisions

This makes it hard to:

* change timing after encoding
* re-export with different FPS
* recompute tables globally
* treat muxing as a pure, final step

---

### Media Bunny

Media Bunny goes further and does a lot very well:

* reading
* decoding
* encoding
* writing
* conversion
* live pipelines

However, it is still fundamentally **write-while-things-are-happening**.

It wants to own:

* decoding
* encoding
* muxing
* flow control

That makes it powerful, but hard to embed as a **small, composable piece** inside a larger editor pipeline.

NativeMuxer does one thing:

> given finished encoded samples and track metadata, write a correct MP4.

Nothing more.

---

## Why not mux.js

**mux.js is not a general-purpose MP4 file muxer.**
It was designed to solve a very specific browser playback problem.

### What mux.js was built for

mux.js exists primarily to support **browser video streaming**, especially in combination with Video.js.

Its core job is to take **streaming media formats** and convert them into something a browser can play *as the data is arriving*.

Specifically, mux.js is designed to:

* Accept **MPEG Transport Stream (MPEG-TS)** input
  MPEG-TS is a packet-based container format commonly used for live video streams and broadcast delivery.
  It is optimized for continuous transmission, not for complete files.

* Output **fragmented MP4 (fMP4)** segments
  Fragmented MP4 is a variant of the MP4 container designed for incremental playback.
  Instead of one complete file, the media is split into an initialization segment and many small media segments.

* Feed those fragments into **Media Source Extensions (MSE)**
  Media Source Extensions are a browser application programming interface that allows JavaScript to append media segments to a video element for playback.
  MSE requires media to arrive in small, ordered chunks suitable for streaming.

mux.js was created to bridge the gap between streaming formats and browser playback requirements.

---

### How mux.js works in practice

mux.js assumes a **progressive, streaming workflow**:

* Media data arrives over time, packet by packet
* Samples are processed incrementally
* Output is produced continuously, not all at once

You do not give mux.js a complete movie and ask it to compile a file.

Instead, you:

* Feed it packets
* Let it emit fragments suitable for immediate playback
* Append those fragments to an MSE buffer

This model works extremely well for **streaming video players**.

---

### Streaming formats mux.js is designed around

mux.js is tightly aligned with common streaming delivery standards:

* **TS (Transport Stream)**
  A shorthand for MPEG-TS.
  Widely used in live streaming and broadcast pipelines.

* **HLS (HTTP Live Streaming)** and **DASH (Dynamic Adaptive Streaming over HTTP)**
  These are streaming protocols that deliver video as many small segments over the network.
  They rely on incremental delivery and adaptive playback rather than full files.

mux.js fits naturally into these ecosystems because it assumes:

* the media is incomplete
* timing decisions are made as packets arrive
* playback correctness matters more than final file determinism

---

### Why mux.js does not fit NativeMuxer

NativeMuxer solves a **different problem**.

NativeMuxer is designed to:

* Work with a **complete set of encoded samples**
* Derive timing tables, chunk layout, and offsets *after* everything is known
* Produce a **single, finalized MP4 file**
* Treat muxing as a deterministic compilation step, not a streaming process

mux.js does not expose:

* a clean “here is my full sample list” boundary
* control over global table derivation
* the ability to revise timing or layout before writing bytes

It emits streaming fragments, not finished files.

---

### The key difference, in simple terms

mux.js answers this question:

> “How do I get streaming video data into a browser video element as it arrives?”

NativeMuxer answers this question:

> “How do I compile a complete MP4 file once all media decisions are known?”

Because mux.js is optimized for **live and streaming playback**, it is not suitable as the core muxer for a browser-native, non-linear video editor.

That limitation is by design, not a flaw.

---

## NativeMuxer in Mobile and Embedded App Environments

NativeMuxer is often described as “browser-native”, but that phrase can be misleading.

NativeMuxer is **not browser-dependent**.

It is written in plain, standards-compliant JavaScript and depends only on:

* deterministic logic
* plain objects
* integers
* typed arrays (`Uint8Array`)

It does **not** depend on:

* the DOM
* WebCodecs
* MediaRecorder
* browser globals
* Node.js APIs
* native bindings
* build tooling

As a result, NativeMuxer runs unchanged **anywhere JavaScript runs**.

This includes:

* desktop browsers
* Node.js
* Electron
* mobile apps with embedded JavaScript runtimes
* React Native (with a JS engine and typed arrays)
* Capacitor / Cordova environments
* server-side and edge pipelines

NativeMuxer is best understood not as a browser feature, but as a **portable MP4 compilation engine**.

---

### Why NativeMuxer Is Especially Valuable on Mobile

Mobile platforms already have strong encoding capabilities.

On iOS and Android, it is common to have access to:

* hardware-accelerated H.264 encoders
* platform media APIs that produce encoded frames
* codec configuration data
* accurate timestamps

What mobile platforms often *lack* is:

* a deterministic MP4 compiler
* explicit control over container structure
* the ability to re-export without re-encoding
* a debuggable, testable container layer
* a clean separation between encoding and muxing

NativeMuxer fills that gap.

It allows mobile applications to:

* treat encoding as an external concern
* treat MP4 assembly as a deterministic compilation step
* repackage encoded samples without touching media bytes
* make global timing and layout decisions *after* encoding is complete

This aligns naturally with mobile export workflows, where rendering and encoding may happen asynchronously or in the background, but file generation must be correct, repeatable, and final.

---

### File-Centric Export vs Streaming Pipelines

Many existing media libraries are optimized for **streaming pipelines**.

They assume that:

* frames arrive over time
* timing decisions must be committed incrementally
* output must be produced progressively
* structure is inferred while writing

This model works well for:

* live capture
* playback pipelines
* real-time streaming

It works poorly for **editing and export**.

Mobile editing applications are fundamentally file-centric:

* the final structure is known only at the end
* sections may be retimed
* captions and overlays may be shifted globally
* exports may be repeated with different parameters
* correctness matters more than immediacy

NativeMuxer assumes this file-centric model by design.

It requires all semantic decisions to be made first, and only then emits bytes. This makes it particularly well-suited to mobile editors, captioning tools, and offline-first media applications.

---

### Determinism Matters More on Mobile, Not Less

Mobile environments introduce variability:

* different devices
* different OS versions
* different hardware encoders
* constrained debugging tools
* limited reproducibility

In this context, **determinism is not a luxury**.

NativeMuxer guarantees:

* the same inputs always produce the same MP4 bytes
* container structure is explicit and testable
* failures occur at semantic boundaries, not during playback

This allows mobile teams to:

* snapshot-test exports
* compare output across devices
* reason about changes confidently
* isolate encoding issues from container issues

Instead of asking “does it play on this phone?”, you can ask “did anything change at all?”

That shift dramatically reduces debugging cost.

---

### Encoding Is a Plug-In, Not a Dependency

NativeMuxer intentionally does not encode.

That is not a limitation, it is an architectural boundary.

On mobile, encoding may come from:

* platform media APIs
* hardware encoders
* background services
* remote encoding pipelines
* hybrid native/JS bridges

NativeMuxer does not care.

As long as encoded samples and codec configuration are provided, NativeMuxer can assemble a correct MP4 file.

This makes it possible to:

* swap encoders without rewriting export logic
* support multiple platforms with a single muxer
* evolve encoding strategies independently
* keep container logic stable over time

NativeMuxer treats encoding as a **replaceable upstream concern**, not as something it must own.

---

### Browser-Native Does Not Mean Browser-Only

NativeMuxer was initially motivated by browser-based workflows, but its design deliberately avoids browser lock-in.

“Browser-native” here means:

* no native binaries
* no system dependencies
* no platform-specific assumptions
* safe, sandboxed execution

Those same properties make it a strong fit for:

* mobile apps
* desktop apps
* embedded runtimes
* serverless environments

The same code path can be used across all of them.

---

### Summary

NativeMuxer is not tied to the browser.

It is a portable, deterministic MP4 compiler that happens to be written in JavaScript.

On mobile, where encoding is available but container control is often opaque or brittle, NativeMuxer provides something rare:

* explicit structure
* reproducible output
* clean separation of concerns
* long-term maintainability

For mobile applications that treat video export as a compilation step rather than a recording, NativeMuxer is not a compromise.

It is an advantage.

---

## Why not MediaRecorder

At first glance, **MediaRecorder** looks like the obvious solution:

* It runs in the browser
* It can output MP4 (or WebM)
* It feels “native”
* It produces playable files

However, MediaRecorder is fundamentally a **capture API**, not a compilation tool.

It is designed for **recording a live media stream**, not for exporting a finished piece of edited media.

---

### What MediaRecorder is designed for

MediaRecorder assumes this model:

1. A MediaStream exists (camera, microphone, canvas, or MediaStreamTrack)
2. Media flows through that stream **in real time**
3. The browser records whatever passes through
4. The result is a file that reflects *what happened during recording*

This is perfect for:

* webcam recording
* screen capture
* live commentary
* simple “record what you see” workflows

In other words:

> MediaRecorder records time as it passes.
> It does not *decide* time.

---

### Why that breaks non-linear editing

A non-linear editor works the opposite way.

In a non-linear workflow:

* frames may be rendered out of order
* sections may be re-timed
* captions may be shifted globally
* overlays may be added after the fact
* the final structure is not known until the end

MediaRecorder cannot support this because:

* timing is committed **while recording**
* samples are written incrementally
* there is no opportunity to revise structure later
* the browser controls chunking and tables
* you cannot “rewind” or recompute global timing

Once MediaRecorder has written a frame, **it is baked in**.

---

### MediaRecorder forces real-time constraints

Even when recording a canvas, MediaRecorder still enforces a *real-time mindset*:

* frames are captured at wall-clock time
* dropped frames are silently accepted
* timing jitter is absorbed into the recording
* export speed is tied to playback speed

This means:

* exporting a 10-minute video takes 10 minutes
* you cannot export faster than real time
* precision timing adjustments are difficult or impossible
* determinism is not guaranteed

For an editor or captioning system, this is a deal-breaker.

---

### MediaRecorder hides container decisions

MediaRecorder does not expose:

* sample timing tables
* chunk layout
* offsets
* edit lists
* codec configuration handling
* container policy decisions

All of this is browser-managed, opaque, and implementation-dependent.

You get a file — not control.

That makes MediaRecorder unsuitable if you need to:

* inspect MP4 structure
* ensure deterministic output
* compare output against a golden file
* guarantee byte-for-byte reproducibility
* re-export with different timing without re-rendering

---

### MediaRecorder is not deterministic

Two recordings with MediaRecorder:

* may differ between browsers
* may differ between versions
* may differ based on system load
* may differ based on capture timing

For creative recording, this is fine.

For a compiler-style export pipeline, it is unacceptable.

NativeMuxer, by contrast, guarantees:

> same inputs → same bytes

Every time.

---

### The key distinction

MediaRecorder answers this question:

> “How do I record media *as it happens*?”

NativeMuxer answers this question:

> “How do I compile a media file *once everything is decided*?”

Those are fundamentally different problems.

---

### Why MediaRecorder cannot be “fixed” for this use case

This is not a missing feature or a configuration issue.

MediaRecorder is constrained by design:

* it owns the timeline
* it owns the stream
* it owns the container decisions
* it commits output incrementally

Trying to use MediaRecorder as the core export mechanism for a non-linear editor forces you to:

* simulate real-time playback
* accept timing jitter
* sacrifice determinism
* lose structural control

At that point, the editor becomes a recording hack, not a compiler.

---

### How NativeMuxer differs in practice

NativeMuxer:

* does **not** record
* does **not** assume real time
* does **not** own rendering
* does **not** own encoding

Instead, it:

1. Accepts finished encoded samples
2. Treats them as immutable facts
3. Derives global timing and structure
4. Emits a complete MP4 file in one pass

This is the same mental model used by professional non-linear editors — applied in a browser-native, offline-capable way.

---

### Summary

MediaRecorder is excellent at what it was designed to do.

NativeMuxer exists because **that design goal is incompatible with non-linear editing**.

If you need:

* capture → MediaRecorder is correct
* editing → MediaRecorder is the wrong abstraction

NativeMuxer fills the gap MediaRecorder was never meant to cover.

---

## Why not ffmpeg.wasm

ffmpeg.wasm is an impressive project.

It brings a full FFmpeg build into the browser and enables decoding, encoding, filtering, and muxing without server-side processing.

However, ffmpeg.wasm optimizes for **capability**, not for **composability**.

### Tooling and Integration Assumptions

In practice, ffmpeg.wasm assumes:

- a modern JavaScript build pipeline
- module bundling
- asynchronous runtime orchestration
- a framework-oriented environment

While it is technically possible to use ffmpeg.wasm without React or heavy tooling, doing so requires navigating:

- complex loading semantics
- environment-specific globals
- build-time and runtime configuration
- non-trivial debugging when assumptions are violated

For small, library-style tools intended to be:

- downloaded
- imported directly
- run in plain JavaScript
- embedded into existing render graphs

this integration cost is significant.

### Architectural Mismatch

ffmpeg.wasm is a **general-purpose media engine**.

It wants to own:

- decoding
- encoding
- filtering
- muxing
- execution flow

NativeMuxer is intentionally the opposite.

It does one thing:

> given finished encoded samples and explicit intent, compile a correct MP4.

This makes NativeMuxer easy to:

- embed as a single module
- reason about in isolation
- test deterministically
- integrate without adopting a toolchain

### Power vs Precision

ffmpeg.wasm is the right choice when you need:

- full codec support
- format conversion
- complex filters
- a self-contained media pipeline

NativeMuxer exists for a narrower but different need:

- deterministic MP4 assembly
- late-bound timing and structure
- zero build tools
- explicit ownership of container decisions

The choice is not about which tool is “better”.

It is about which assumptions you are willing to accept.

---

## What NativeMuxer gives you on the ground

If you have **all encoded frames**, NativeMuxer lets you:

* export the same video at 24, 30, or 60 fps **without re-encoding**
* retime sections safely
* adjust caption timing globally
* change chunking and tables without touching media data
* re-export instantly
* reason about MP4 structure deterministically

This is especially useful for:

* browser-based video editors
* captioning tools
* accessibility tooling
* research tools
* offline-first workflows
* privacy-sensitive apps
* systems that want to avoid server-side rendering

---

## What NativeMuxer is not

NativeMuxer is **not**:

* a recorder
* a live streaming tool
* a transcoder
* a full media framework

It does not:

* decode
* encode
* render
* manage UI
* decide creative intent

It assumes those steps already happened.

---

## The design philosophy

* deterministic
* composable
* file-centric
* testable against golden MP4s
* no hidden state
* no lifecycle surprises

Given the same inputs, it produces the same bytes.
Every time.

---

## Why this exists

NativeMuxer was built because a browser-native captioning and overlay tool needed:

* full control over timing
* the ability to re-export
* a clean separation between rendering and muxing
* no forced streaming lifecycle

Existing tools could not be plugged in cleanly without fighting their assumptions.

Building a small, focused muxer turned out to be simpler and more reliable.

---

## Who this is for

If you are building:

* a non-linear video editor in the browser
* a captioning or accessibility tool
* a media pipeline where structure is decided late
* a system that treats MP4 as a *compiled artifact*, not a stream

NativeMuxer is for you.

If you just need to:

* record
* stream
* convert formats

You probably want one of the existing tools.
