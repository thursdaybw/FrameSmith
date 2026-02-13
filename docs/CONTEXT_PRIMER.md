PROJECT SUMMARY
---------------
Framesmith is a client-side video composition engine. It renders captions, 
styles, animations, overlays, and exports video using WebCodecs.

MODULES OVERVIEW
----------------
captionModel.js   — Converts Whisper JSON into timing + text + intent.
stylePreset.js    — Defines static visual styles.
animationRegistry — Pure time-based style transforms.
wordLayout.js     — Temporary layout system (x/y positions).
captionRenderer   — Applies layout-style → draw-style → canvas.
script.js         — Orchestrates preview loop.
applyAnimations   — Applies animation behaviors to styles.

CURRENT PHASE A LIMITATIONS
---------------------------
- Layout hardcoded (line height, padding).
- Renderer does layout + draw together (to be separated).
- highlightFill still used (to be replaced by activeStyle).
- No RenderPlan yet.

DIRECTION OF TRAVEL
-------------------
1. Move layout constants into StylePreset.
2. Replace highlightFill with activeStyle and activeAnimations.
3. Create LayoutEngine module.
4. Introduce RenderPlan abstraction.
5. Renderer consumes RenderPlan.
6. WebCodecs export loop.
7. Podcast auto-editor built on same pipeline.

STYLE AND ANIMATION RULES
-------------------------
- Static style → resolveStyle()
- Dynamic style → applyAnimations()
- Animations never affect geometry.
- Presets and animations must have non-colliding semantics.

