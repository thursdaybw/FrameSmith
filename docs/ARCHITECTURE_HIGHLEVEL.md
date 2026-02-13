1. **A Project Requirements Document (PRD)**
2. **A Status Report (current progress + next gates)**
3. **A clear explanation of the overall vision**
4. **A statement of architectural philosophy for this project**

---

# 📘 **PROJECT REQUIREMENTS DOCUMENT (PRD)**

### **Project Name:**

**FRAMESMITH** — A browser-based video composition engine.

(You may rename it later. But every good system deserves a working title.)

---

# 🎯 **1. Purpose / Problem Statement**

Creators want to generate high-quality social media videos with:

* Captions
* Word-level highlighting
* Custom styles
* Logos and overlays
* Basic animations (pulse, fade, pop)
* Timeline-based editing
* Full MP4 export

Current tools rely on:

* Heavy backends
* Server-side rendering
* FFMPEG pipelines
* Expensive SaaS subscriptions
* Closed systems

The goal is to deliver a **lightweight**, **client-side**, **open**, **modular** alternative capable of:

* Real-time preview
* Browser-only rendering
* WebCodecs export
* Whisper transcription integration
* Future timeline editing
* Extensibility for new overlays and effects

✨ Appendix to Section 1 — Expanded Problem Statement (Podcast Auto-Editor)

In addition to short-form social video creation, creators increasingly record podcasts, dual-camera interviews, and remote conversations. Editing these manually requires:

Cutting silences

Switching camera angles

Removing filler sounds

Highlighting speaker transitions

Aligning transcript with video

Keeping audio/video in sync

Exporting a finished episode

Existing tools (Descript, Riverside, Premiere) are:

Paid subscription SaaS

Heavy to run

Not customizable

Not transparent in how edits are chosen

Not built for lightweight, mobile-friendly workflows

Not designed for your pipeline, which includes remote guests, OBS scene recording, and Whisper transcripts

Framesmith must eventually support podcast auto-editing, meaning:

Multi-track audio analysis

Silence trimming

Speaker turn detection

Automatic camera/scene switching

Text-driven editing (edit by transcript)

Rendering a combined timeline

These needs overlap with your captions engine because:

Both rely on timed events

Both rely on an intermediate representation (RenderPlan)

Both require animation and compositing

Both ultimately export MP4 using WebCodecs

Both consume Whisper transcripts for word-level timing

Both must support future timeline editing

Thus: the caption renderer is not a side feature — it is the seed of the entire podcast editor engine.

---

🌍 Product Vision (Full System Including Podcast Auto-Editor)

Framesmith is a browser-based media engine that unifies:

1. Short-form social video tooling (Phase 1–2)

### 🌟 **Unified Caption & Media Effects System**

Framesmith captions are not limited to karaoke highlighting.
The system is designed to support the full spectrum of contemporary caption and storytelling formats, including:

* Emphasis word highlighting
* One-word-at-a-time storytelling mode
* Typewriter and cursor effects
* Slide-up caption blocks
* Emoji-on-word overlays
* Semantic emphasis (AI-chosen)
* Left/right/center bounded caption regions
* Dynamic caption placement
* Multi-element motion graphics

This flexibility requires:

1. A **state-driven Effects Layer**
2. A **time-driven Animation Engine**
3. A **RenderPlan** capable of expressing multiple nodes per word
4. A **LayoutEngine** that can position caption regions anywhere on the canvas

Framesmith is therefore not a caption tool —
it is a lightweight browser-native *compositing engine* for social video and podcast storytelling.

2. Long-form podcast/video interview editing (Phase 3–4)

Multi-track timeline representation

Whisper transcription ingestion

Silence trimming automation

Speaker detection

Automated scene switching

Text-based editing

Multi-element compositing

3. A general-purpose RenderPlan pipeline (Phase 4–5)

Every visual element becomes a declarative render node

Animations become reusable behaviors

Export becomes deterministic

Browser-only rendering becomes possible

Server fallback still possible (Node + WebCodecs + Canvas + Offscreen)

4. A creator-focused platform

All in the browser. No installs.
No SaaS lock-in.
Built for creators who want:

Full control

Low cost

Portability

Extensibility

Transparency

5. One codebase → multiple tools

Framesmith is simultaneously:

A caption engine

A meme/video overlays tool

A podcast auto-editor

A minimal timeline editor

A template system (brand presets)

A WebCodecs-based export engine

This is not “a caption tool.”
This is your After Effects, your Descript, your CapCut — but open, modular, and yours.

---

# 🧱 **3. Core Architectural Principles**

These come from decades of clean-code, clean-architecture practice.

### **Principle 1 — Separation of Concerns**

No layer should know the internal workings of another.

### **Principle 2 — Data should not know how to draw itself**

Models must be sterile. No rendering logic.

### **Principle 3 — Renderers should be dumb**

Renderers should be mechanical:
"Here is your plan. Draw it exactly."

### **Principle 4 — Style is configuration, not logic**

The style system exists outside layout, data, and renderer.

### **Principle 5 — Animation is an optional transformation**

Animation should modify style **before** rendering, never modify layout.

### **Principle 6 — Everything must be swappable**

Whisper backend, caption formats, style presets, the rendering engine —
all replaceable without rewriting everything.

### **Principle 7 — Fail fast on architecture, not on implementation**

Test MP4 export early.
Test audio extraction early.
Confirm feasibility before polishing.

### **Principle 8 — All future functionality must fit into the RenderPlan concept**

Even though we are not implementing RenderPlan yet, **the architecture must naturally evolve toward it**.

---

# 🧩 **4. High-Level Architecture (Current + Planned)**

```
            +----------------------+
            |   UI / Controls      |
            +----------------------+
                        |
                        v
            +----------------------+
            |  Project Model       |
            | (captions, elements) |
            +----------------------+
                        |
             Whisper → CaptionSegments
                        |
                        v
            +----------------------+
            |    Layout Engine     |
            | (wrapping, geometry) |
            +----------------------+
                        |
                 RenderPlan (future)
                        |
                        v
            +----------------------+
            |   Style System       |
            | presets + overrides  |
            +----------------------+
                        |
                        v
            +----------------------+
            |   Renderer Layer     |
            | (draw to canvas)     |
            +----------------------+
                        |
                        v
            +----------------------+
            |   Export Engine      |
            | WebCodecs MP4 Export |
            +----------------------+
```

**Renderer → Export** is a one-way flow.

---

# 📊 **5. Functional Requirements**

### MVP (current phase)

* Ingest Whisper JSON
* Convert to caption segments
* Display timed captions on canvas
* Word-level highlight
* Style presets
* Inline style overrides
* Simple animated style (pulse)
* Real-time preview (canvas loop)

### Next Required Milestones

* Prepare RenderPlan abstraction
* Add element layering (captions, logo, etc.)
* Add animation scheduling
* Add MP4 export (WebCodecs)
* Add audio extraction (native WebAudio)

### Future Capabilities

* Multiple renderers
* Rendering to off-screen canvas
* GPU-accelerated compositing
* Saving/loading project states
* Server-side render fallback (Node/WebCodecs or WASM)

---

# 🔍 **6. Non-Functional Requirements**

* Must run entirely in browser
* Must not rely on ffmpeg.wasm for decode
* Must produce MP4 export under 3 seconds for 15s clips
* Must allow deterministic output (given same project data)
* Code must remain modular and testable
* Should degrade gracefully on low-end devices
* APIs should be explicit and declarative, not magical

---

# 📌 **7. Constraints**

* No backend-required transcription (unless user provides key)
* Browser must perform rendering
* iOS Safari has partial WebCodecs support (plan fallback later)
* No heavy WASM unless absolutely needed
* Memory footprint must stay small (mobile creators!)

---

# 📈 **8. Current Status (as of your last message)**

### Completed

✔ Basic caption model
✔ Whisper → caption converter
✔ Layout engine (line wrapping)
✔ Style presets + overrides
✔ Animated style (pulse)
✔ Renderer draws captions correctly
✔ Word-level highlight
✔ Real-time preview loop
✔ All files modularized

### In Progress (next action)

➡ **Integrate pulse preset + renderer wiring**
You paused mid-task. This is the next concrete step.

### Upcoming, in order:

1. Add per-word animation engine (pulse already started)
2. Add per-element (logo) rendering hooks
3. Add RenderPlan abstraction (incrementally)
4. Add MP4 export loop
5. Add audio extraction (WebAudio)
6. Add Whisper integration (OpenAI → server proxy)

---

# 🧭 **9. The Architectural Philosophy (Human Version)**

Your system is built around one core truth:

**Rendering and data must remain independent so the system can grow.**

If captions own their own rendering, you’re stuck.
If renderer owns styles, you're stuck.
If layout owns animation, you're stuck.

Every mistake at this level becomes a prison.

We are building the opposite of a prison.
We are building a stage where each actor knows their role:

* **Model → who says what, and when**
* **Styles → what they look like**
* **Layout → where they stand**
* **Renderer → how they are drawn**
* **Animation → how they move**
* **Export → record the performance**

This clarity is what allows:

* More features
* Faster changes
* Clean interactions
* New developers onboarding
* Future integrations

It’s the same philosophy used in UIKit, Flutter, Chrome, and React Native — because it **works**.
