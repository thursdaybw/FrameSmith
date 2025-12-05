/**
 * Caption renderer (Phase A).
 *
 * Responsibility:
 *   - Determine active words
 *   - Resolve layout-style → layout geometry
 *   - Apply animated draw-style
 *   - Draw primitives to canvas
 *
 * Must NOT:
 *   - Decide global styles
 *   - Store state across frames
 *   - Perform complex layout (future LayoutEngine)
 */
import { resolveStyle } from "./stylePreset.js";
import { applyAnimations } from "./applyAnimations.js";
import { wrapWordsIntoLines } from "./wordLayout.js";
import { validateCaption } from "./captionValidator.js"; // optional but recommended
import { resolveActiveStyle } from "./activeStyle.js";

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

  if (window.renderPlan && window.renderPlan.elements) {
    for (const node of window.renderPlan.elements) {
      if (node.type === "image") {
        const { image, x, y, width, height } = node.props;
        if (width && height) ctx.drawImage(image, x, y, width, height);
        else ctx.drawImage(image, x, y);
      }
    }
  }

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

  /**
   * Layout uses ONLY the static layoutStyle.
   *
   * WHY:
   *   - Layout must remain stable, unaffected by animations.
   *   - Geometry must originate from style presets, not renderer guesses.
   *   - Allows future LayoutEngine and RenderPlan to cleanly replace this step.
   */
  const lines = wrapWordsIntoLines(ctx, seg.words, canvas.width, layoutStyle);

    /**
     * RENDERPLAN SEAM (Phase Zero)
     *
     * The renderer currently receives { lines, items } from the layout engine.
     * In future phases, this will be replaced by a RenderPlan structure
     * produced by the LayoutEngine and Effects/Animation layers.
     *
     * DO NOT allow renderer to depend on layout-specific shapes.
     * DO NOT allow renderer to compute geometry.
     *
     * This seam ensures we can introduce:
     *   - multi-element captions
     *   - emoji overlays
     *   - bounding boxes
     *   - timeline-based compositing
     */
  // Now draw, word by word, with animated transforms
  for (const line of lines) {
    for (const item of line.items) {
      const { word, x, y, wordIndex } = item;

      const layoutStyle = layoutStyles[wordIndex];
      const drawStyle = computeDrawStyle(layoutStyle, seg, word, t);

      ctx.font = `${drawStyle.fontSize}px ${drawStyle.fontFamily}`;
      ctx.textAlign = "left";

      const isActive = (word === seg.words[highlightIdx]);
      const finalStyle = resolveActiveStyle(drawStyle, isActive);

      ctx.fillStyle = finalStyle.fill;


      ctx.fillText(word.text, x, y);
    }
  }
}

