// =============================
// layout.js
// Wrapping + positioning utilities
// =============================

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

