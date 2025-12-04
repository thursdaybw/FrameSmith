export function wrapWordsIntoLines(ctx, words, maxWidth) {
  const lines = [];
  let currentLine = { items: [], width: 0 };

  for (const word of words) {
    const w = word.text + " ";
    const wWidth = ctx.measureText(w).width;

    if (currentLine.width + wWidth > maxWidth && currentLine.items.length > 0) {
      lines.push(currentLine);
      currentLine = { items: [], width: 0 };
    }

    currentLine.items.push({ word });
    currentLine.width += wWidth;
  }

  if (currentLine.items.length > 0) {
    lines.push(currentLine);
  }

  // Vertical + horizontal positioning
  const totalHeight = lines.length * 50; // placeholder, refine later
  const startY = ctx.canvas.height - totalHeight - 40;

  let y = startY;
  for (const line of lines) {
    const xStart = (ctx.canvas.width - line.width) / 2;

    let cursor = xStart;
    for (const item of line.items) {
      item.x = cursor;
      item.y = y;
      cursor += ctx.measureText(item.word.text + " ").width;
    }

    y += 50;
  }

  return lines;
}

