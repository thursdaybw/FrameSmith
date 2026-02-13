
# ✔ FINAL: Corrected MVP Spec (drop-in replacement)

Paste this section into your MVP document.

---

# **Corrected Minimum Viable Product (MVP)**

The true MVP is defined by the *minimum architecture capable of producing a downloadable MP4* with captions and a brand overlay, without blocking future development of the RenderPlan engine.

---

## ✔ 1. Load a video file in the browser

Single video source. No timeline. No clip operations.

---

## ✔ 2. Transcribe audio using Whisper

* load JSON
* convert into CaptionModel

No editing interface required.

---

## ✔ 3. Apply static + animated caption style

* static style from StylePreset
* pulse animation
* active-word highlight effect
* captions drawn via captionRenderer

No RenderPlan caption subtree required.

---

## ✔ 4. Display a pulsing overlay image

Rendered via RenderPlanRenderer from RenderPlan overlay nodes.

---

## ✔ 5. Composite each frame

Composite must include:

* decoded video frame
* overlay image
* captions
* animation effects

Using a unified compositor (RenderPlanRenderer or temporary version).

---

## ✔ 6. Encode using WebCodecs

* generate monotonic timestamps
* encode H.264 video
* audio optional for MVP (but supported later)

Raw H.264 output acceptable in early MVP.
Muxed MP4 is Phase B.

---

## ✔ 7. Download the final output

The user receives a rendered video file with captions and brand overlay.

This is the minimum product users will pay for.


## ✔ **THE MINIMUM ARCHITECTURE REQUIRED FOR THE MVP**

Here is the trick:

### The MVP **does NOT need a full RenderPlan**, full LayoutEngine, full animation unification, node polymorphism, or multi-track editing.

But —

### The MVP DOES need a safe architectural seam preventing lock-in.

That seam is exactly:

1. **RenderPlan is created**

2. **RenderPlanRenderer draws:**

   * video frame
   * overlay nodes
   * captionRenderer output

3. **captionRenderer draws only captions**

This creates a clean boundary:

```
RenderPlanRenderer (global compositor)
    ↓
captionRenderer (semantic text renderer)
```

And that boundary **prevents lock-in** and supports all future development.

---


## ✔ What we DO need for the MVP

### Bare minimum modules:

#### **1. captionRenderer**

Simple. Draw the words.

#### **2. RenderPlanRenderer**

Render overlays + captions + video frame.

#### **3. RenderPlan**

Just contains:

* array of overlay nodes
  That’s it.

#### **4. animationRegistry + effectsRegistry**

Caption animations only (pulse), overlay animation handled locally in RenderPlanRenderer.

#### **5. script.js preview + encoder loop**

This becomes the orchestration layer.

---

# ✔ **Canonical Roadmap (Phase A → Phase B → Final Architecture)**

This replaces your scratchpad.
This is now the official roadmap for Framesmith.

---

# **MVP Architecture (Today)**

```
CaptionModel
    ↓
StyleResolver
    ↓
LayoutEngine (wrapWordsIntoLines)
    ↓
Animations (caption-only; Phase A)
    ↓
Effects (active-word; early seam)
    ↓
Renderer (dumb text drawer)
    ↓
WebCodecs Export (future)
```

### Purpose

The MVP pipeline is deliberately simple.
Animations and effects operate directly on caption styles.
Layout is static, based only on style presets.
Renderer is dumb and draws what it's told.

No RenderPlan is required to ship the MVP.

---

# **Hybrid Transitional Architecture (MVP + Seams)**

```
CaptionModel
    ↓
StyleResolver
    ↓
LayoutEngine
    ↓
TempLayoutStructure      ← THIS is the "proto-RenderPlan"
    ↓
Animations
    ↓
Effects (registry)
    ↓
Renderer (still dumb)
```

### Purpose

This stage introduces:

* the Effects Registry
* the RenderPlan seam
* the first non-caption drawable element (image overlay)
* the architectural boundaries that make RenderPlan possible

This is the scaffolding for the future engine.

---

# **Future Architecture (Full Engine)**

```
CaptionModel
    ↓
StyleResolver
    ↓
LayoutEngine
    ↓
RenderPlan
    ↓
RenderPlanRenderer (multi-track compositor)
    ↓
Export Engine (WebCodecs or GPU)
```

RenderPlan becomes the **single source of truth** for:

* captions
* images
* overlays
* transitions
* camera cuts
* auto-editor output
* filters
* effects
* animations
* blending
* compositing

The renderer becomes a pure compositor of declarative instructions.

---

# **Guiding Architectural Principle**

**"Everything we build today must be replaceable by RenderPlan tomorrow
without rewriting the renderer or layout logic."**

This is the north star.

---

# ✔ **STEP-BY-STEP ROADMAP (Corrected, Clean, and Aligned with Architecture)**

## **STEP 1 — Animation Purification (DONE)**

* Removed highlightFill
* Pulse is style-only
* No animation performs semantic decisions

MVP is now safe to introduce Effects.

---

## **STEP 2 — Effect System Introduction (CURRENT STEP)**

**Goal:**
Remove all highlighting logic from renderer and unify active-word behavior under effects.

### 2A — Pulse does not depend on active word

✓ Done.

### 2B — Remove `highlightFill` entirely

✓ Done (or trivial to delete).

### 2C — Turn active word into an effect

✓ Complete.

### 2D — Remove renderer highlight logic

✓ Complete.

Renderer now draws whatever style it is given.
It does not interpret meaning.

This is Clean Architecture.

---

## **STEP 3 — Style-Driven Layout**

Renderer must not compute geometry.

### 3A — Update `wrapWordsIntoLines` to use layoutStyle

* maxWidthMultiplier
* lineHeightMultiplier
* verticalOffset
* fontSize

### 3B — Remove hardcoded 50px and 40px constants

Replace with style-driven geometry exclusively.

This unlocks the LayoutEngine.

---

## **STEP 4 — LayoutEngine Abstraction**

Create:

```
layout/LayoutEngine.js
```

Responsibilities:

* measure text
* compute word wrapping
* compute geometric positions
* build a temporary layout structure (proto-RenderPlan)

Renderer never touches layout again.

This is the start of true Clean Architecture.

---

## **STEP 5 — RenderPlan Seam (We Added This Already)**

We already have:

```
renderPlan/RenderPlan.js
```

Now we begin introducing:

* overlay nodes
* effect nodes
* caption nodes (later)
* RenderPlanRenderer

**The MVP still uses the temporary layout structure.
RenderPlan will shadow it.**

This gives you *multi-element compositing* today
and full compositing tomorrow
without rewriting the system.

---

## **STEP 6 — Unified Animation Model (Just Finalized)**

Animations apply to **nodes**, not domains.

No duplicate registries.
No caption-vs-overlay split.
Only domain-agnostic animation functions.

Phase A: caption-only
Phase B: node-type dispatch
Phase C: apply animation to any RenderPlan node

---

## **STEP 7 — Renderer Replacement (Future)**

Renderer becomes:

```
RenderPlanRenderer.renderFrame(t, renderPlan, ctx)
```

CaptionRenderer becomes a child renderer invoked only for caption nodes.

Script.js becomes orchestration only.

---

## **STEP 8 — Multi-Track Compositing**

Introduce:

* VideoTrack[]
* AudioTrack[]
* OverlayLayer[]
* CaptionBlock subtree
* Effect nodes
* Transitions

And the substrate for your podcast auto-editor:

* cut detection
* scene selection
* clip switching
* timeline alignment

All from the RenderPlan.

---

# ✔ Summary:

What you have is **not a scratchpad anymore**.
You now have a **Clean Architecture roadmap** that:

* removes lock-in
* preserves all current work
* respects the future design
* ensures RenderPlan is approached correctly
* prevents drift
* aligns with animation + effects unification
* supports all short-form and long-form video features you want

---

## Architecture

Renderer.js
/**
 * RENDERPLAN ARCHITECTURE — CURRENT STATE & FUTURE EVOLUTION
 * ----------------------------------------------------------
 *
 * CURRENT MODEL (PHASE A)
 * -----------------------
 * We use a *flat display list*. Each frame produces a RenderPlan:
 *
 *    {
 *      elements: [ CaptionElement, ImageElement, ... ]
 *    }
 *
 * Each element:
 *  - knows its properties at this moment in time (position, opacity, scale…)
 *  - knows how to draw itself onto a canvas
 *  - is independent of other elements
 *
 * This is the simplest system that can possibly work for:
 *    - captions
 *    - highlight effects
 *    - static/animated logos
 *    - simple overlays
 *
 * WHY NOT A SCENE GRAPH YET?
 * --------------------------
 * A hierarchical scene graph (groups, transforms, child inheritance)
 * is powerful *but unnecessary* until real grouping needs arise.
 *
 * Introducing hierarchy too early increases complexity without
 * delivering value. The flat model keeps the system:
 *    - easy to extend
 *    - easy to understand
 *    - easy to replace
 *
 * WHEN WE WILL EVOLVE TO PHASE B (SCENE GRAPH)
 * --------------------------------------------
 * We evolve the architecture the moment **any** of these occur:
 *
 *  1. Multiple drawing elements require coordinated transforms
 *     e.g. a logo composed of 3 shapes that animate together.
 *
 *  2. Elements need to inherit motion/opacity/filters from a parent.
 *
 *  3. Timeline features require grouped transitions:
 *       - fade/scale entire caption blocks
 *       - animate “multi-element” transitions
 *       - group overlays into moveable units
 *
 *  4. You introduce reusable animation rigs or presets
 *     e.g. “TitleCard → SlideIn + DropShadow + Glow”.
 *
 *  5. You want elements to be addressable at *group* granularity
 *     instead of just individual items.
 *
 * HOW EVOLUTION WILL HAPPEN
 * -------------------------
 * The shift from A → B does NOT require a rewrite.
 *
 * We simply allow:
 *
 *    RenderPlan.elements = [ Element | Group ]
 *
 * And define:
 *
 *    class Group {
 *        children = [...]
 *        transform = { translate, scale, rotate, opacity }
 *    }
 *
 * Before rendering:
 *
 *    The renderer flattens the tree into draw commands.
 *
 * This preserves everything we built so far while enabling
 * advanced composition in the future.
 *
 * WHY DOCUMENT ALL THIS?
 * ----------------------
 * This file is the architectural *lighthouse*. Its job is to:
 *
 *   - Explain why the current design exists
 *   - Show how it intends to evolve
 *   - Protect the system from accidental misuse
 *   - Give future developers (or LLMs) the context to extend it properly
 *
 * Think of this as the "Direction of Travel" baked into the codebase.
 */

RenderElement.js
/**
 * ELEMENT CONTRACT
 * -----------------
 * Every drawable element in the system must implement:
 *
 *    element.draw(ctx)
 *
 * and must represent a *single visual item* on screen.
 *
 * Elements DO NOT:
 *   - know about other elements
 *   - compute layout for siblings
 *   - access global styles directly
 *   - mutate canvas state outside their draw call
 *
 * These rules keep the render pipeline deterministic and composable.
 *
 * FUTURE EVOLUTION
 * ----------------
 * When we introduce Group (hierarchical composition):
 *    - elements remain unchanged
 *    - groups simply wrap and transform them
 *
 * This isolation is what makes the architecture evolvable.
 */

CaptionElement.js
/**
 * CAPTION ELEMENT PHILOSOPHY
 * --------------------------
 * CaptionElement is an *actor* in the system.
 *
 * It does NOT:
 *   - decide font choices
 *   - decide colors
 *   - decide background box shape
 *   - decide highlight effects
 *
 * All those come from:
 *    - CaptionStyle (styling rules)
 *    - CaptionEffect (animations)
 *
 * CaptionElement only knows:
 *    - what words exist
 *    - when they appear
 *    - where they should render on the canvas
 *
 * The styling and visual interpretation is intentionally external.
 *
 * This separation allows future features such as:
 *    - switching style presets
 *    - speaker-specific styles
 *    - dynamic effects (shake, glow, pulse)
 *    - karaoke modes
 *    - ASS-style inline overrides
 */

Renderer.js
/**
 * ELEMENT CONTRACT
 * -----------------
 * Every drawable element in the system must implement:
 *
 *    element.draw(ctx)
 *
 * and must represent a *single visual item* on screen.
 *
 * Elements DO NOT:
 *   - know about other elements
 *   - compute layout for siblings
 *   - access global styles directly
 *   - mutate canvas state outside their draw call
 *
 * These rules keep the render pipeline deterministic and composable.
 *
 * FUTURE EVOLUTION
 * ----------------
 * When we introduce Group (hierarchical composition):
 *    - elements remain unchanged
 *    - groups simply wrap and transform them
 *
 * This isolation is what makes the architecture evolvable.
 */

