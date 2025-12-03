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
 * WHEN WE EVOLVE THIS FILE:
 *   - When StylePreset exists, renderer stops picking any
 *     visual parameters and instead obeys computed style rules.
 *   - When RenderPlan exists, renderer draws elements instead
 *     of computing layout here.
 */

import { CaptionStyles, findActiveSegment, findActiveWord } from "./captionModel.js";
import { wrapLine } from "./layout.js";

export function drawCaptions(ctx, canvas, segments, t) {

  // (1) Find active segment
  const seg = findActiveSegment(segments, t);
  if (!seg) return;

  // (2) Determine active word
  const activeWordIdx = findActiveWord(seg.words, t);

  // (3) Prepare drawing
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const style = CaptionStyles[seg.style] || CaptionStyles.default;
  ctx.font = style.font;

  const maxWidth = canvas.width * 0.9;
  const lines = wrapLine(ctx, seg.text, maxWidth);

  const lineHeight = parseInt(style.font) * 1.3;
  const baseY = canvas.height - 150;

  // (4) Draw each line (bottom up)
  lines.forEach((line, i) => {
    const y = baseY - (lines.length - 1 - i) * lineHeight;

    if (activeWordIdx >= 0) {
      drawHighlightedLine(ctx, line, seg.words, activeWordIdx, style, canvas.width/2, y);
    } else {
      drawNormalLine(ctx, line, style, canvas.width/2, y);
    }
  });
}


// ---- Supporting draw functions ----

function drawNormalLine(ctx, line, style, x, y) {
  if (style.stroke) {
    ctx.lineWidth = style.strokeWidth;
    ctx.strokeStyle = style.stroke;
    ctx.strokeText(line, x, y);
  }

  ctx.fillStyle = style.fill;
  ctx.fillText(line, x, y);
}


function drawHighlightedLine(ctx, line, wordList, highlightIdx, baseStyle, x, y) {
  const words = line.split(" ");

  let currentX = x - ctx.measureText(line).width / 2;

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const width = ctx.measureText(w + " ").width;

    const isActive = (i === highlightIdx);
    const style = isActive ? CaptionStyles.highlightPrimary : baseStyle;

    // Draw background
    if (style.background) {
      ctx.fillStyle = style.background;
      ctx.fillRect(currentX - 4, y - 40, width + 8, 50);
    }

    // Draw stroke
    if (style.stroke) {
      ctx.lineWidth = style.strokeWidth;
      ctx.strokeStyle = style.stroke;
      ctx.strokeText(w, currentX + width / 2, y);
    }

    // Draw fill
    ctx.fillStyle = style.fill;
    ctx.fillText(w, currentX + width / 2, y);

    currentX += width;
  }
}

