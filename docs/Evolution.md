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

