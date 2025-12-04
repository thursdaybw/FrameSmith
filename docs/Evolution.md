# Framesmith Evolution Log

A chronological record of architectural decisions.  
This log prevents architectural drift and explains the reasoning behind changes.

---

## 2025-03-XX — Style vs Animation Pulse Ambiguity
- Removed preset override `pulse`.
- Retained animation behavior `pulse`.
- Clarified separation between static presets and dynamic animations.
- Future: unify animation behaviors under Animation Tracks.

---

## 2025-03-XX — Layout and Drawing Separation
- Introduced layout-style (static) vs draw-style (animated).
- Renderer now applies animation after layout.

---

## 2025-03-XX — Multi-Level Styling Intent
- CaptionModel now supports segment-level and word-level overrides/animations.
- StyleResolver collapses all levels into a resolved style.

---

## 2025-03-XX — Roadmap Formalization
- Added RenderPlan as core evolution target.
- Documented architecture evolution path in Architecture.md.

---

2025-03-XX — Moved active-word styling out of renderer
- Renderer no longer chooses highlight behavior.
- Added resolveActiveStyle() to isolate styling decisions.
- highlightFill logic is no longer owned by the renderer.
- Renderer remains responsible only for detecting active word (Phase A).
- Prepares system for StyleResolver and future karaoke effects.

---

## 2025-03-XX — Step B: Centralize layout values under StylePreset

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

