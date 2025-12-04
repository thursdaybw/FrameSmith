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

import { resolveStyle } from "./stylePreset.js";
import { applyAnimations } from "./applyAnimations.js";
import { wrapWordsIntoLines } from "./wordLayout.js";
import { validateCaption } from "./captionValidator.js"; // optional but recommended

// NEW helper: compute *layout* style (static)
function computeLayoutStyle(segment, word, presetName) {
  const allOverrides = [
    ...(segment.override || []),
    ...(word.override || [])
  ];

  return resolveStyle(presetName, allOverrides);
}

// Compute *animated* drawing style
function computeDrawStyle(layoutStyle, segment, word, t) {
  const allAnimations = [
    ...(segment.animate || []),
    ...(word.animate || [])
  ];

  // Apply animations to the layout style.
  return applyAnimations(layoutStyle, t, allAnimations);
}

function chooseLayoutStyle(segment, presetName) {
  const segmentOverrides = segment.override || [];

  if (segment.words.length > 0) {
    const firstWord = segment.words[0];
    const wordOverrides = firstWord.override || [];

    return resolveStyle(presetName, [
      ...segmentOverrides,
      ...wordOverrides
    ]);
  }

  return resolveStyle(presetName);
}

export function drawCaptionForTime(t, ctx, canvas, captions, presetName = "default") {
  const seg = captions.find(c => t >= c.start && t < c.end);
  if (!seg) return;

  // Optional dev safety check
  if (typeof validateCaption === "function") {
    validateCaption(seg);
  }

  // Which word is highlighted?
  const highlightIdx = seg.words.findIndex(w => t >= w.start && t < w.end);

  // IMPORTANT: For layout, we use base styles ONLY.
  // Build an array of layoutStyles to freeze geometry.
  const layoutStyles = seg.words.map(word =>
    computeLayoutStyle(seg, word, presetName)
  );

  // This ensures wrapWordsIntoLines uses stable measurements.
  const layoutStyle = chooseLayoutStyle(seg, presetName);
  ctx.font = `${layoutStyle.fontSize}px ${layoutStyle.fontFamily}`;

  // Layout using static font sizes ONLY
  const lines = wrapWordsIntoLines(ctx, seg.words, canvas.width);

  // Now draw, word by word, with animated transforms
  for (const line of lines) {
    for (const item of line.items) {
      const { word, x, y, wordIndex } = item;

      const layoutStyle = layoutStyles[wordIndex];
      const drawStyle = computeDrawStyle(layoutStyle, seg, word, t);

      ctx.font = `${drawStyle.fontSize}px ${drawStyle.fontFamily}`;
      ctx.textAlign = "left";

      // Highlight color logic — kept separate
      const isHighlighted = seg.words[highlightIdx] === word;

      ctx.fillStyle = isHighlighted
        ? drawStyle.highlightFill
        : drawStyle.fill;

      ctx.fillText(word.text, x, y);
    }
  }
}

