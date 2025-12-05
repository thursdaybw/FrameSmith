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

