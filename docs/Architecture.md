# Framesmith Architecture

Framesmith is a browser-based media engine for rendering captions,
animations, overlays, and video exports using WebCodecs.

This document describes the architectural boundaries, contracts, and
direction of travel for the system. All source-level docblocks refer
back to this file.

---

# 1. Core Principles

## 1.1 Separation of Concerns
Each subsystem owns a single responsibility:

- Model → stores data only.
- Layout → computes geometry.
- Style → defines appearance.
- Animation → transforms style over time.
- Renderer → draws primitives to the canvas.
- Export → serializes rendered frames to MP4.

No subsystem leaks responsibilities into another.

## 1.2 Data Is Passive
CaptionModel holds timing, text, and declarative styling/animation
intent. It contains **no layout**, **no style rules**, and **no drawing logic**.

## 1.3 Renderer Is Dumb
Renderer consumes drawable instructions. It must never:
- choose fonts,
- choose colors,
- compute layout rules,
- store state.

It simply draws.

## 1.4 Styles Are Declarative
StylePreset defines static visual parameters.
Animations modify style over time.
These systems remain independent.

## 1.5 Animations Modify Style, Not Layout
Animations are pure functions:
(style, t) → newStyle

Layout always uses static styles.

## 1.6 Everything Evolves Toward RenderPlan
The long-term architecture converges on:

Model → LayoutEngine → RenderPlan → Renderer → Export

RenderPlan becomes the canonical description of the frame.

## 1.7 Effects Layer (State-Driven Style Transform)

Effects are declarative, state-based transformations applied to elements in the RenderPlan.

Unlike animations (which are time-driven and continuous), effects activate based on:

- Caption timing (word becomes active)
- Semantic emphasis (AI marks a word important)
- User styling rules (bold this phrase)
- Caption mode (typewriter, storyteller)
- Segment transitions (slide-in/out)
- Element interactions (emoji following a word)

Effects may:

- modify draw-style
- spawn sub-elements (boxes, emojis, cursors)
- request layout adjustments (handled by LayoutEngine)

Effects do not:

- compute geometry
- select fonts/colors arbitrarily
- draw to canvas
- store state

The Effects Layer is essential for supporting modern short-form caption styles (TikTok, Reels, Shorts) and advanced presentation features.

---

# 2. System Overview

→ CaptionModel
→ LayoutEngine
→ StyleResolver
→ AnimationEngine
→ RenderPlan
→ Renderer
→ Export


Each stage transforms data without side effects.

---

# 3. Module Responsibilities

## CaptionModel
- Converts Whisper JSON into internal segments.
- Stores timing and declarative styling intent.
- No knowledge of layout or rendering.

## LayoutEngine
- Computes positions of words, lines, and blocks.
- Outputs geometry suitable for RenderPlan.
- Based on static styles only.

## StylePreset / StyleResolver
- Defines static appearance.
- Applies preset + override hierarchy.
- Produces resolved layout-style and draw-style.

## AnimationEngine
- Applies time-based transforms to draw-style.
- Behaviors must be pure functions.
- Layout is never animated.

## RenderPlan
- Future: declarative list of drawable elements.
- Middle layer between layout and renderer.

## Renderer
- Reads RenderPlan or temporary structures.
- Draws primitives onto canvas.
- Stateless and deterministic.

## Export Engine
- Encodes frames via WebCodecs.
- Reuses the Renderer for deterministic output.

---

# 4. Naming and Clarity Style

This project favors explicit, cognitively clear naming.  
Examples:

- `getThePointAtPercentFromAtoB`
- `getTheColorAtPercentFromAtoB`

Clarity over brevity.  
Every function should communicate intent to future developers and to LLMs.

---

# 5. Direction of Travel

1. Move layout constants into StylePreset.
2. Introduce LayoutEngine module.
3. Introduce RenderPlan abstraction.
4. Renderer begins consuming RenderPlan exclusively.
5. Add multi-element composition and timeline features.
6. Add podcast auto-editing pipeline based on the same architecture.

This file governs all architectural decisions.

