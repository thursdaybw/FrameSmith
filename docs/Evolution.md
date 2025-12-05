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

