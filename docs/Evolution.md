# Framesmith Evolution Log

A chronological record of architectural decisions.  
This log prevents architectural drift and explains the reasoning behind changes.

---

## 2025-03-03 — Style vs Animation Pulse Ambiguity
- Removed preset override `pulse`.
- Retained animation behavior `pulse`.
- Clarified separation between static presets and dynamic animations.
- Future: unify animation behaviors under Animation Tracks.

---

## 2025-03-03 — Layout and Drawing Separation
- Introduced layout-style (static) vs draw-style (animated).
- Renderer now applies animation after layout.

---

## 2025-03-03 — Multi-Level Styling Intent
- CaptionModel now supports segment-level and word-level overrides/animations.
- StyleResolver collapses all levels into a resolved style.

---

## 2025-03-04 — Roadmap Formalization
- Added RenderPlan as core evolution target.
- Documented architecture evolution path in Architecture.md.

---

## 2025-03-04 — Moved active-word styling out of renderer
- Renderer no longer chooses highlight behavior.
- Added resolveActiveStyle() to isolate styling decisions.
- highlightFill logic is no longer owned by the renderer.
- Renderer remains responsible only for detecting active word (Phase A).
- Prepares system for StyleResolver and future karaoke effects.

---

## 2025-03-04 — Step B: Centralize layout values under StylePreset

- Removed hardcoded layout constants from wordLayout.js.
- Introduced clean, named functions for spacing and positioning.
- Layout engine now reads:
    - fontSize
    - lineHeightMultiplier
    - verticalOffset
    - maxWidthMultiplier
  from layoutStyle (resolved from StylePreset).
- Renderer now passes layoutStyle to wrapWordsIntoLines.
- No visual changes, but architectural consistency restored.
- Layout rules are now declarative, testable, and ready for future LayoutEngine.

---

## **2025-03-05 — Introduced RenderPlan Seam and Effect Registry**

* Added initial RenderPlan directory with placeholder node factories.
* Renderer annotated with a RenderPlan seam to prevent layout–renderer coupling.
* Added functional Effect Registry with `default` active-word effect.
* `resolveActiveStyle` now delegates to the effect registry, establishing a clean extension point.
* No runtime behavior changed except routing active-word styling through the registry.
* Lays foundation for future effects (typewriter, slide-up, emoji bursts) without impacting MVP.

---

## 2025-03-05 — First Real RenderPlan Node: Logo Overlay

- Introduced the first functional RenderPlan element (image node).
- Logo overlay is now rendered as a RenderPlan image element, separate from caption text.
- Added MVP scaling logic based on video metadata (percentage of canvas width).
- Implemented a temporary pulse animation for the logo directly in script.js.
- CaptionRenderer remains unchanged; RenderPlan is now active for non-caption elements.
- This marks the beginning of multi-element compositing and validates the RenderPlan seam.
- Implementation deliberately lives in script.js as a safe, temporary integration layer.
- Prepares system for future structured layout engines for images, titles, and overlays.

---

## 2025-03-05 — Unified Animation Model and Elimination of Parallel Registries

- Identified a conceptual smell: animationRegistry was implicitly caption-specific,
  conflicting with upcoming overlay and video-track animations.
- Clarified that Framesmith uses a *single conceptual animation namespace*
  (e.g., "pulse" means the same animation concept everywhere).
- Established that animations apply polymorphically to RenderPlan node types,
  with different execution paths for words, image overlays, and video clips.
- Prevented the creation of parallel animation registries (caption vs overlay)
  which would cause architectural drift.
- Confirmed the long-term model: animations operate at the RenderPlan node level,
  with node-type dispatch determining practical behavior.
- Phase A note: caption animations remain in the caption pipeline temporarily,
  while overlay animations are handled inside RenderPlanRenderer until the unified
  animation dispatcher is introduced.

---

## **2025-03-05 — ExportEngine Consolidation + MP4 Muxer Decision**

* Chose **full MP4 export with audio** as a non-negotiable MVP requirement.
* Documented that WebCodecs cannot mux audio and video into MP4 on its own.
* Adopted **MP4Box.js** as the official muxing layer for Framesmith.
* Introduced a Phase A `ExportEngine` that temporarily handles:

  * video encoding,
  * audio encoding,
  * muxing.
* This consolidation is explicitly temporary and will be split into:

  * `VideoEncoderEngine`,
  * `AudioEncoderEngine`,
  * `MuxerEngine`,
  * `ExportOrchestrator`,
    in Phase B as multi-track rendering is introduced.
* Ensures clean evolution toward a professional-grade compositor without locking the MVP into a premature or brittle export architecture.

---

## 2025-03-05 — Added RenderPlanRenderer and Temporary Overlay Animation

- Introduced `RenderPlanRenderer` as the top-level compositor responsible for:
  - drawing the video frame,
  - drawing overlay nodes,
  - delegating caption rendering.
- Removed all overlay drawing from `captionRenderer` and `script.js` to respect
  caption vs overlay boundaries.
- Moved temporary overlay pulse animation into `RenderPlanRenderer` as a
  deliberate Phase A concession.
- Animation in `RenderPlanRenderer` will be relocated to a unified animation 
  dispatcher in Phase B.
- This completes the core rendering seam required for WP4Box-based MP4 export.
---

## 2025-03-05 — MP4Box.js Vendor Strategy Formalized

- CDN instability confirmed (unexpected export syntax, 404s, mismatched bundles).
- MVP will temporarily consume a pinned CDN build for velocity.
- Production plan adopted:
    - vendor MP4Box.js source via git submodule or fork
    - build artifact locally using Docker to avoid host Node installation
- Ensures long-term stability, version-locking, and sovereign control over media export pipeline.

---

## **2025-03-07 — Empirical Export Pipeline Validation**

* Implemented full decode→composite→encode loop.
* Discovered raw MP4 timestamps cannot be used for WebCodecs encoding.
* Introduced monotonic timestamp generator (frameIndex * frameDuration).
* Verified that compositor must sit between decoder and encoder.
* Confirmed that RenderPlan seam is required earlier than planned.
* Raw H.264 output validated encoding correctness. (with jitter)

This discovery forces the architecture to treat compositing as part of the export pipeline.

---

## **2025-03-07 — First True Compositor Integration**

* RenderPlanRenderer (or temporary composite function) now produces the final raster for each decoded frame.
* CaptionRenderer remains separate; overlay nodes handled by RenderPlanRenderer.
* This establishes the final rendering architecture's shape, even in MVP.

---

## **2025-03-07 — Demuxer Contract Formalized**

* MP4BoxDemuxer validates the required demuxer interface:

  * parse()
  * getVideoTrackInfo()
  * getAvcCBuffer()
* Established that all future demuxers must return:

  * compressed samples
  * track metadata
  * avcC description
* This creates a stable abstraction layer beneath ExportEngine.

---

## **2025-03-07 — MVP Scope Realignment**

* Discovered that RenderPlan must exist (minimally) for MP4 compositing to remain clean.
* MVP now officially includes:

  * minimal RenderPlan
  * RenderPlanRenderer
  * compositor inside ExportEngine
* But excludes all non-essential RenderPlan features:

  * caption subtree
  * effect nodes
  * animation polymorphism
  * structured schemas

This keeps MVP minimal while protecting long-term evolution.

---

# **Evolution Log Entry (paste into Evolution.md)**

## **2025-03-08 — MP4 Muxing Elevated to Phase A**

* Raw H.264 export proved insufficient for validating overlay rendering, caption rendering, or timestamp correctness.
* Playback jitter disguised pipeline issues, making raw output unreliable for confirming MVP.
* Verified that users cannot meaningfully use raw H.264 files.
* Therefore, MP4 muxing (video only, audio optional) is now a **Phase A requirement**.
* ExportEngine must produce a valid MP4 file before MVP is considered complete.
* Audio passthrough (not re-encoding) becomes part of Phase A to verify synchronization and container structure.
* This discovery shifts several Phase B responsibilities into Phase A because they are foundational to MVP correctness.

---

# **Updated MVP Definition (paste over old one)**

## ✔ **THE TRUE MVP (Revised)**

The MVP must output a **valid MP4 file** containing:

1. **Video source frames**
2. **Caption rendering**
3. **Overlay image(s)**
4. **Animations**
5. **Correct timestamps and ordering**
6. **Audio track (pass-through acceptable)**

WebCodecs encoding without muxing is **not a functional MVP export**.

---

## **2025-12-09 — Retirement of Mediabunny for WebCodecs Muxing**

### **Background**

After pivoting away from MP4Box.js due to its lack of a proper MP4 authoring API, Framesmith experimented with Mediabunny as a potential muxing layer. Mediabunny appeared promising because it provided high-level MP4 output utilities, internal Isobmff muxing, and a browser-friendly ES module build.

However, multiple structural issues surfaced.

### **Findings**

1. **Mediabunny assumes ownership of the entire encoding pipeline.**
   It expects packets in an internal format, with metadata and side-data generated by its own encoder. External WebCodecs chunks do not satisfy these invariants.

2. **Video chunk validation is enforced deep inside the library.**
   Even when top-level validators were patched, internal assertions continued to fail (metadata, track info, and avcC assumptions). These invariants are tightly coupled to Mediabunny’s built-in canvas encoder.

3. **Mediabunny cannot operate as a “dumb muxer.”**
   It is architected as an end-to-end pipeline (encode → packetize → mux), not as a component that accepts arbitrary Annex-B H.264 streams.

4. **Attempting to adapt Mediabunny would require extensive patching.**
   Internal assertions appear at many layers: packet validation, track metadata composition, box construction, and configuration assembly. Fixing one led to another, demonstrating misalignment with Framesmith’s design.

### **Architectural Insight**

Framesmith requires:

* a predictable muxing layer
* a library that accepts raw WebCodecs `EncodedVideoChunk`s
* deterministic control over SPS/PPS, codec metadata, and timestamps
* clean boundaries per Clean Architecture principles

Neither MP4Box.js nor Mediabunny satisfy this requirement.

This confirms the correctness of having a `MuxerEngine` abstraction: dependencies can be retired without architectural disruption.

### **Outcome**

Mediabunny is now retired as a candidate muxing engine.

The next step for Framesmith is to implement a minimal, self-contained MP4 muxer tailored to WebCodecs output. This avoids dependency drift, validation mismatches, and external architectural assumptions.

### **Conclusion**

This phase clarified that external muxing libraries introduce more friction than value for Framesmith’s goals. A lightweight in-house muxer aligns best with the system’s architecture, simplicity, and long-term maintainability.

---

