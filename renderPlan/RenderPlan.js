/**
 * RenderPlan (Phase Zero — Seam Only)
 *
 * Responsibility (future):
 *   - Represent a declarative list of drawable elements.
 *   - Contain geometry, style, animations, effects, and children nodes.
 *   - Act as the single source of truth for what the renderer draws.
 *
 * Current Phase (MVP):
 *   - This file defines only the *shape* and *factory* for RenderPlan nodes.
 *   - No system generates a full RenderPlan yet.
 *   - Renderer does NOT consume this structure yet.
 *
 * WHY THIS EXISTS NOW:
 *   - Establishes the architectural seam.
 *   - Prevents layout/renderer code from hard coding assumptions.
 *   - Ensures all future features funnel toward a single abstraction.
 *   - Lets MVP evolve into CAD-like compositing without a rewrite.
 */

export function createRenderPlanNode(type, props = {}) {
  return {
    type,       // e.g. "word", "line", "captionBlock", "emoji", etc.
    props,      // style, text, timing, etc.
    children: [] // future: nested nodes for effects/emojis/backgrounds
  };
}

/**
 * Future: create a full RenderPlan (root-level)
 */
export function createRenderPlan() {
  return {
    elements: []  // array of top-level nodes
  };
}
