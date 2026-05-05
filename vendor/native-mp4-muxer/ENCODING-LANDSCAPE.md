# Encoding Landscape and Platform Realities

NativeMuxer intentionally does **not** encode media.

That decision was not ideological.
It was forced by reality.

This document records the current state of browser-based video encoding,
the trade-offs involved, and why NativeMuxer is designed as a compiler
that sits *after* encoding rather than owning it.

This is not a comparison of features.
It is a record of constraints.


Scope note
This document describes encoding-layer realities in browser-based video applications.
NativeMuxer itself is encoder-agnostic and works in Firefox when supplied with encoded samples.
These constraints apply to applications like FrameSmith that must produce those samples in-browser.


---

## The Ideal Case: WebCodecs

WebCodecs is the best available browser-native encoding API.

When available, it provides:

- direct access to hardware encoders
- explicit control over timestamps and durations
- offline and faster-than-realtime encoding
- deterministic, inspectable output
- clean separation between render, encode, and mux

WebCodecs fits NativeMuxer’s architecture perfectly.

This is the primary and preferred encoding path.

---

## The Firefox Gap

As of today, Firefox does **not** support WebCodecs encoding.

This creates a real platform gap.

Firefox currently offers no browser-native API that provides:

- deterministic encoding
- explicit timestamp control
- offline export
- clean integration with non-linear render graphs

This is not a limitation of NativeMuxer.
It is a limitation of the platform.

---

## MediaRecorder (Why It Is Not a Substitute)

MediaRecorder exists in Firefox and can produce playable files.

However, MediaRecorder is a **capture API**, not an export API.

It assumes:

- real-time media flow
- browser-owned timing
- incremental writing
- opaque container decisions

MediaRecorder answers this question:

> “How do I record what is happening right now?”

NativeMuxer exists to answer a different question:

> “How do I compile a finished media file once all decisions are known?”

Because MediaRecorder commits timing and structure as media flows,
it cannot support:

- non-linear editing
- retiming after render
- deterministic output
- faster-than-realtime export
- byte-level inspection or testing

For recording, MediaRecorder is correct.
For editing and export, it is the wrong abstraction.

---

## ffmpeg.wasm (Technically Possible, Practically Hostile)

ffmpeg.wasm can encode H.264 in Firefox.

In theory, this fills the WebCodecs gap.

In practice, it introduces significant friction:

- large WASM payloads
- CPU-only encoding
- heavy runtime cost
- opaque performance characteristics
- complex initialization
- bundler and framework assumptions
- difficult debugging when things fail

In particular, integration proved difficult in plain JavaScript environments.
Documentation and examples frequently assume modern frontend frameworks,
making “drop-in” usage unrealistic for simple, dependency-free tools.

ffmpeg.wasm is viable as a **last-resort compatibility bridge**,
but it is not a clean foundation for a deterministic editor pipeline.

---

## Other Browser-Side Encoding Options (Why They Fall Short)

### WASM Encoders (x264, OpenH264, etc.)

Experimental WebAssembly ports exist, but they are generally:

- slow
- incomplete
- poorly maintained
- difficult to integrate
- lacking clear per-frame APIs
- unsuitable for production use

They offer fewer guarantees and more maintenance burden than ffmpeg.wasm.

---

### GPU / Shader-Based Encoding Experiments

There are research and demo projects that attempt encoding via WebGL or WebGPU.

These approaches:

- do not implement full H.264 compliance
- lack entropy coding
- provide no rate control
- cannot guarantee decoder compatibility

They are educational experiments, not production encoders.

---

## Server-Side Encoding (The Clean Escape Hatch)

The only fully clean alternative for Firefox today is server-side encoding.

In this model:

1. The browser renders frames
2. Frames or intermediate data are uploaded
3. Encoding is performed using real hardware encoders
4. NativeMuxer assembles the final MP4 deterministically

This avoids all browser encoder limitations, at the cost of:

- requiring a backend
- increased latency
- privacy and cost considerations

Architecturally, this option remains compatible with NativeMuxer.

---

## Why NativeMuxer Is Encoder-Agnostic

The instability of browser encoding APIs is precisely why NativeMuxer exists.

Encoders are:

- platform-dependent
- performance-sensitive
- volatile
- outside application control

NativeMuxer treats encoded samples as **facts**, not as a stream.

By separating encoding from muxing:

- encoding can change
- muxing remains stable
- tests remain meaningful
- output remains deterministic

This separation is what allows:

- WebCodecs on Chromium
- ffmpeg.wasm as a fallback
- server-side encoding if required
- future encoders to be swapped in cleanly

NativeMuxer survives encoder churn.

---

## Current Reality Summary

| Encoding Option | Firefox | Deterministic | Offline | Integration |
|----------------|--------|---------------|---------|-------------|
| WebCodecs | ❌ | ✅ | ✅ | Excellent |
| MediaRecorder | ✅ | ❌ | ❌ | Easy but unsuitable |
| ffmpeg.wasm | ✅ | ⚠️ | ⚠️ | High friction |
| WASM encoders | ⚠️ | ❌ | ⚠️ | Poor |
| Server-side | ✅ | ✅ | ✅ | Clean but requires backend |

There is no Firefox-native equivalent to WebCodecs today.

This is a platform reality, not an architectural failure.

---

## Design Implication

NativeMuxer does not attempt to “solve encoding”.

It provides a stable, deterministic compilation target for **any encoder** that can supply:

- encoded samples
- timestamps
- durations
- codec configuration

That boundary is intentional.
That boundary is what makes the system robust.

---

## Closing Note

This document exists to prevent architectural backsliding.

The absence of a clean Firefox encoder is frustrating,
but compromising determinism, testability, or structure
to paper over that gap would undermine the entire system.

NativeMuxer is designed to be correct first,
and adaptable second.

That trade-off is deliberate.
