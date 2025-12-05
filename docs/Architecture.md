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

In the MVP, RenderPlan is used in a limited capacity to merge caption
layout nodes with a logo overlay node, enabling multi-element rendering
without replacing the existing caption layout structure.

Because the MVP now includes multiple drawable element types
(captions + logo overlay), the RenderPlan abstraction becomes an active
part of the system earlier than originally anticipated. For the MVP,
RenderPlan is used only to unify caption nodes with a single logo node,
while caption layout continues to use the temporary structure. This
provides multi-element compositing immediately, without committing to
the full RenderPlan system yet.

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

### MVP Note: Logo as Effect Target
The pulsing logo uses the same style mutation mechanism as captions.
This validates the effect pipeline without expanding the effects system
beyond MVP requirements.

The Effects Layer is essential for supporting modern short-form caption styles (TikTok, Reels, Shorts) and advanced presentation features.

---

## **1.8 Caption vs Overlay Rendering Boundaries**

Framesmith distinguishes two classes of drawable images, each with different architectural responsibilities:

### **Global Overlay Elements**

These are visual elements not tied to caption semantics. They:

* exist independently of any words,
* have their own geometry and timing,
* appear even when captions are absent,
* belong at the RenderPlan root level,
* are rendered by `RenderPlanRenderer`.

Examples include: logos, stickers, watermarks, corner badges, or any graphic that is not derived from caption content.

### **Caption-Semantic Elements**

These elements are part of the caption meaning, timing, or effects. They:

* depend on word-level geometry,
* follow caption timing,
* participate in caption effects and animations,
* are rendered inside the caption rendering pass,
* will eventually become child nodes within a `CaptionBlock` subtree of the RenderPlan.

Examples include: emojis replacing words, icons behind active words, starburst effects, karaoke glows, bounding boxes, and word-level decorative elements.

### **Renderer Responsibilities**

* `RenderPlanRenderer` draws **all global overlay elements** and orchestrates the full composition pipeline, including the video frame.
* `captionRenderer` draws **only caption-semantic content** and must not draw global overlays.

This separation ensures clear architectural boundaries, prevents leakage of responsibilities, removes duplication, and enables multi-element compositing without long-term rendering debt.

### **Temporary Phase A Note**

During Phase A, captions are still rendered outside the RenderPlan.
`RenderPlanRenderer` will temporarily accept `captions` as a parameter.
This is transitional.
In future phases, captions will be generated as a subtree of the RenderPlan, eliminating this temporary boundary.

## **1.9 Multi-Track Compositing Model (Future Architecture)**

We will introduce:

- camera A / camera B switching
- jump cuts
- overlays that depend on clip boundaries
- timeline tracks
- transitions between clips
- audio-driven effects
- podcast auto-editor logic

Framesmith is evolving toward a full compositing engine similar in structure to professional NLE systems (Kdenlive, Resolve, Premiere, CapCut).
Each frame is not built from a single video source, but from a **Render State** composed of multiple independent visual layers.

A rendered frame may contain:

* Zero or more **video sources** or clips
* Zero or more **global overlays** (logos, stickers, titles, graphic elements)
* Zero or more **caption-semantic elements** (text, emoji, word effects)
* Zero or more **effect nodes** (glows, bursts, animations)
* A dynamic **style + animation state**
* Time-conditioned logic driven by captions, audio, or metadata

This is expressed through the RenderPlan data model, which will eventually support:

```
RenderPlan
  ├── VideoTrack[]        ← clips, transitions, cuts, camera switching
  ├── AudioTrack[]        ← waveforms, sync, auto-editor signals
  ├── CaptionBlock        ← word tree, semantic effects, caption overlays
  ├── OverlayLayer[]      ← stickers, logos, dynamic graphic packs
  ├── EffectNodes[]       ← glows, bursts, bounces, particle effects
  └── TimelineControls    ← easing, fades, markers, transitions
```

Then, each frame is built by:

RenderPlanRenderer.composeFrame(t) →
    resolve timeline state →
    resolve clip for each track →
    resolve effects + animations →
    draw frame elements in correct order →
    return Frame

### Core Principle

RenderPlan becomes the **single source of truth** for every visual element in the frame.
RenderPlanRenderer becomes the **only compositor**, drawing:

1. The selected video frame(s)
2. Overlay layers
3. Caption-semantic elements
4. Effect nodes
5. Any future track-based or time-based elements

---

# 2. System Overview

→ CaptionModel
→ LayoutEngine
→ StyleResolver
→ AnimationEngine
→ RenderPlan (partial: caption nodes + logo node)
→ Renderer
→ Export

---

# ✔ **Section 1.10 Unified Animation Model**

Paste this *verbatim* over the existing section.

---

## **1.10 Unified Animation Model (RenderPlan-Level Animation and Effects)**

Framesmith treats animation as a **unified, declarative system** that operates on RenderPlan nodes.
Animations are not tied to captions, overlays, video, or any specific domain.
Instead, each animation describes *how a node’s properties evolve over time*.

### Core Principle

> **Animations are defined once, and applied uniformly to any node type capable of responding to them.**
> Node type determines *what* properties can be animated, not *whether* they can be animated.

This prevents the creation of parallel animation systems, avoids duplicated logic, and ensures a single mental model across captions, images, video clips, and future elements.

---

### **Why This Matters**

As Framesmith evolves into a full compositing engine, animation may apply to:

* caption words (style transforms),
* caption blocks (group-level emphasis or motion),
* image overlays (scale, rotation, opacity),
* video clips (zoom, pan, transitions),
* effect nodes (glows, bursts, particles),
* timeline-level transitions and fades.

A unified model eliminates domain boundaries and ensures extensibility.

---

### **How Animations Operate**

Animations in Framesmith modify node properties through a simple contract:

```
animate(node, t) → updatedNode
```

Nodes remain passive data.
Animations are **pure functions** driven by time.

Animations may operate on:

* **style properties** (fontSize, fill, glow, opacity),
* **geometric properties** (x, y, scale, rotation),
* **clip properties** (zoom, crop),
* **effect parameters** (intensity, spread).

Each node type exposes specific animatable fields; animations respect those fields.

---

### **Node-Type Awareness Without Parallel Registries**

Animations live in a **single namespace**, but are free to adapt to different node types:

```
animations.pulse(node, t) {
    if (node.type === "word") { ... }
    if (node.type === "image") { ... }
    if (node.type === "video") { ... }
}
```

This allows a concept such as `"pulse"` to:

* enlarge a word,
* scale an image,
* brighten an effect node,
* subtly zoom a clip.

This maintains conceptual unity while supporting polymorphism.

---

### **Captions vs Overlays (Boundary Rule)**

Captions are semantic content.
Overlays are global compositing layers.

Both participate in the animation system, but animation never introduces semantic meaning or modify caption text.

Animations apply at the node level only — the RenderPlan defines the context.

---

### **Phase A / MVP Transition Note**

Current implementation is transitional:

* Caption animations live in `animationRegistry.js`.
* Overlay animations are temporarily hard-coded in `script.js` and will soon migrate to `RenderPlanRenderer`.
* The unified animation dispatcher will replace both systems in Phase B.

This section defines **the stable architectural destination**, not the temporary MVP code paths.

---

### **Effect Relationship**

Effects are state-driven style changes.
Animations are time-driven property transforms.

Both feed into the RenderPlan node-transform pipeline and share the same conceptual model, ensuring clean future integration.

---

# **1.11 Architectural Risks and Smells (Phase A)**

Phase A of Framesmith contains deliberate simplifications that enable rapid development of the MVP.
These simplifications introduce known architectural smells that must be removed in future phases.
This section documents them explicitly so they are not mistaken for long-term design decisions.

---

## **1.11.1 CaptionRenderer Has Too Many Responsibilities**

`captionRenderer.js` currently performs:

* active word selection
* style resolution
* animation application
* effect application
* layout measurement
* geometry assignment
* drawing
* temporary RenderPlan handling

This violates the Single Responsibility Principle.

**Intent (future):**

```
CaptionLayoutEngine → CaptionRenderPlan → CaptionRenderer
```

Each module will own one step of the pipeline, removing the current monolithic renderer.

---

## **1.11.2 Layout Depends Directly on Canvas Measurement**

Phase A layout uses:

```
ctx.font
ctx.measureText(...)
```

This ties layout to the rendering layer and prevents:

* offline layout
* shared layout caching
* deterministic render planning
* compute-only layout passes
* clean RenderPlan generation

**Intent (future):** introduce a `TextMetricsProvider` abstraction that isolates measurement from rendering.

---

## **1.11.3 script.js Acts as a God Module**

`script.js` currently:

* plays the video
* manages the preview loop
* applies overlay transformations
* initializes the RenderPlan
* loads captions
* draws frames
* triggers animations
* exposes debug functions

The module is a necessary hack for early development but becomes brittle over time.

**Intent (future):**

```
FramesmithEngine.play(video, captions, renderPlan)
```

Script.js will become a UI harness, not an orchestration core.

---

## **1.11.4 String-Based Overrides and Animations Do Not Scale**

Current syntax:

```
override: ["muted"]
animate: ["pulse"]
```

Risks include:

* no parameterization ("pulse fast" vs "pulse slow")
* difficult namespacing
* ambiguous meaning
* no validation
* no schema enforcement
* poor serialization for RenderPlan export

**Intent (future):**

Use structured descriptors:

```
overrides: [{ preset: "muted" }]
animations: [{ name: "pulse", speed: 2.0, amplitude: 0.1 }]
```

---

## **1.11.5 RenderPlan Nodes Lack Schema and Validation**

Current RenderPlan nodes store arbitrary props:

```
{ type: "image", props: { ... } }
```

This invites:

* inconsistent node shapes
* accidental prop drift
* poor introspection for editors or debuggers
* difficulty serializing plans for export
* coupling between renderer and node internals

**Intent (future):**

Define RenderPlan as a typed structure:

```
WordNode
CaptionBlockNode
ImageNode
VideoClipNode
EffectNode
```

with structural validation during plan creation.

---

## **1.11.6 Effects and Animations Overlap Semantically**

Phase A distinction:

* **Effects:** event/state-driven style transforms
* **Animations:** time-driven transforms

But many real behaviors combine both (e.g., karaoke glow, typewriter ripple, slide-in emojis).

This conceptual overlap can cause confusion.

**Intent (future):**

Clear boundary:

* Effects trigger animations or style modifiers based on semantic or timing events.
* Animations drive continuous changes over time.
* Both feed into the unified RenderPlan style-modifier pipeline.

---

## **1.11.7 Temporary Presence of Multiple Render Paths (CaptionRenderer + Script.js)**

During Phase A, images and overlays may be drawn twice or be distributed across multiple render paths.

This is intentional for rapid progress but must be unified.

**Intent (future):**

All drawing flows exclusively through:

```
RenderPlanRenderer.renderFrame(...)
```

CaptionRenderer becomes a subordinate renderer invoked only for caption nodes.

---

# **Summary**

These smells are **not failures** — they are the natural byproduct of rapid MVP construction.
Documenting them preserves architectural integrity and protects the system from fossilizing early hack paths into permanent structure.

All Phase A smells are temporary and will be eliminated as the RenderPlan becomes the single source of truth for all visual elements.


## **1.X Export Architecture (Full MP4 With Audio)**

Framesmith’s MVP requires exporting final composited video with synchronized audio.
The browser’s WebCodecs API provides **audio and video encoders**, but **does not provide a muxer**, and MP4 is a container format requiring one.

### **MP4 Muxing Requirement**

Framesmith uses **MP4Box.js** as the muxing layer because:

* it is browser-compatible and battle-tested,
* it supports WebCodecs packet formats,
* it does not require WASM ffmpeg,
* it integrates cleanly with our architecture.

This muxer is required for producing a final MP4 containing:

* encoded video frames (from RenderPlanRenderer output),
* encoded audio packets (copied from the input video’s audio track),
* timing metadata,
* container structure.

Without this layer, only raw elementary video streams would be possible.

---

## **1.Y ExportEngine (Phase A Consolidation)**

To produce final MP4 output, Framesmith introduces:

```
export/ExportEngine.js
```

In **Phase A**, this module performs *three responsibilities*:

1. **Video Encoding** (WebCodecs `VideoEncoder`)
2. **Audio Encoding** (WebCodecs `AudioEncoder`)
3. **Muxing** (MP4Box.js)

Combining these into a single engine is a **temporary architectural compromise** chosen to:

* prevent premature abstraction,
* simplify MVP integration with the rendering pipeline,
* reduce API surface area while RenderPlan evolves.

This consolidation is intentional and documented.

### **Boundary Guarantee (Phase B Split)**

ExportEngine **must be split** into separate components in Phase B:

```
VideoEncoderEngine
AudioEncoderEngine
MuxerEngine
ExportOrchestrator
```

This split will occur once:

* RenderPlanRenderer stabilizes,
* audio/video track models are introduced,
* multi-track editing, transitions, and auto-editor features are added.

The architecture requires this separation to maintain long-term flexibility and SRP compliance.

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
- Must support drawing multiple element types (e.g., word, logo).
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

