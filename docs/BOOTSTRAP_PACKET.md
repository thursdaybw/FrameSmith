You are assisting with Framesmith — a browser-based compositing engine for captions, 
animations, overlays, and MP4 export.

ARCHITECTURAL OVERVIEW
----------------------
Framesmith architecture follows strict Clean Architecture boundaries:

Model → Layout → StyleResolver → Animation → RenderPlan → Renderer → Export

WHAT THE LLM MUST ENFORCE
-------------------------
- Maintain architecture boundaries when modifying code.
- No mixing layout logic with animation logic.
- No implicit style decisions in renderer.
- No introducing coupling between modules.
- All new features must fit naturally into the future RenderPlan model.

Provide minimal diffs only. Maintain architecture integrity.


