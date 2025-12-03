/**
 * LAYOUT ENGINE — ARCHITECTURE NOTES
 * ----------------------------------
 * Responsible for:
 *   - line wrapping
 *   - positioning
 *   - computing text widths
 *   - producing drawable geometry
 *
 * IMPORTANT SEPARATION OF CONCERNS:
 *   layout != style
 *   layout != drawing
 *   layout != caption parsing
 *
 * The layout engine says:
 *   "Given these words and this max width, how should lines break?"
 *
 * Renderer says:
 *   "Given these positioned lines, draw them."
 *
 * Caption model says:
 *   "Here are the words and timings."
 *
 * This separation ensures we can replace layout algorithms
 * (for example: ASS-like positioning, speaker regions,
 * per-line transforms) without rewriting renderer or model.
 */

export function wrapLine(ctx, text, maxWidth) {
  const parts = text.split(" ");
  const lines = [];
  let current = "";

  for (let p of parts) {
    const test = current ? current + " " + p : p;
    if (ctx.measureText(test).width > maxWidth) {
      lines.push(current);
      current = p;
    } else {
      current = test;
    }
  }

  if (current) lines.push(current);
  return lines;
}

