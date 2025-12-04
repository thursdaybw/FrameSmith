import { resolveStyle } from "./stylePreset.js";
import { applyAnimations } from "./applyAnimations.js";
import { wrapWordsIntoLines } from "./wordLayout.js";

/**
 * CAPTION RENDERER — ARCHITECTURE NOTES
 * -------------------------------------
 * This module draws caption data onto a canvas.
 *
 * CURRENT STAGE (Phase A):
 *   - Receives raw caption timing + word timing
 *   - Computes which words are active
 *   - Draws text directly using canvas instructions
 *   - Performs line wrapping and highlight drawing
 *
 * Now uses StylePreset for visual appearance.
 * Still performs:
 *   - layout
 *   - highlight logic
 *   - drawing*
 *
 * WHAT IT MUST NOT DO:
 *   - Choose global font families
 *   - Choose colors beyond the minimal demo defaults
 *   - Own long-term style definitions
 *   - Hardcode visual rules that should belong to styles
 *
 * WHY:
 *   In future phases, drawing will be performed via a
 *   RenderPlan (a display list) → and later via a scene graph.
 *
 *   This renderer must remain a "dumb projector":
 *       Given drawable instructions → draw them.
 *
 * Future (Phase B):
 *   - Break into: CaptionLayout → RenderPlan → Renderer
 *   - Renderer will consume abstract primitives, not captions*
 *
 * WHEN WE EVOLVE THIS FILE:
 *   - When StylePreset exists, renderer stops picking any
 *     visual parameters and instead obeys computed style rules.
 *   - When RenderPlan exists, renderer draws elements instead
 *     of computing layout here.
 */

// NEW helper: compute style for a word
function computeWordStyle(segment, word, t, presetName) {
  const allOverrides = [
    ...(segment.override || []),
    ...(word.override || [])
  ];

  const allAnimations = [
    ...(segment.animate || []),
    ...(word.animate || [])
  ];

  const base = resolveStyle(presetName, allOverrides);
  return applyAnimations(base, t, allAnimations);
}

export function drawCaptionForTime(t, ctx, canvas, captions, presetName = "default") {
  const seg = captions.find(c => t >= c.start && t < c.end);
  if (!seg) return;

  // highlight logic is now independent
  const highlightIdx = seg.words.findIndex(w => t >= w.start && t < w.end);

  const lines = wrapWordsIntoLines(ctx, seg.words, canvas.width);

  for (const line of lines) {
    for (const item of line.items) {
      const { word, x, y } = item;

      const style = computeWordStyle(seg, word, t, presetName);

      ctx.font = `${style.fontSize}px ${style.fontFamily}`;
      ctx.textAlign = "left";

      // highlight coloring is separate from style overrides
      const isHighlighted = seg.words[highlightIdx] === word;

      if (isHighlighted) {
        ctx.fillStyle = style.highlightFill;
      } else {
        ctx.fillStyle = style.fill;
      }

      ctx.fillText(word.text, x, y);
    }
  }
}

