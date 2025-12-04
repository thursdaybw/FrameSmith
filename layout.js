/**
 * Layout utilities (Phase A).
 *
 * Responsibility:
 *   - Basic text wrapping only.
 *
 * Knows:
 *   - Canvas measurement API.
 *
 * Does NOT know:
 *   - Styles
 *   - Rendering
 *   - Animation
 *
 * Used by:
 *   - LayoutEngine (temporary)
 */

export function wrapLine(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = "";

  for (let w of words) {
    const test = current.length === 0 ? w : current + " " + w;
    if (ctx.measureText(test).width > maxWidth) {
      lines.push(current);
      current = w;
    } else {
      current = test;
    }
  }

  if (current.length > 0) lines.push(current);
  return lines;
}

