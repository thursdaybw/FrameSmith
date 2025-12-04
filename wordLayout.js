/**
 * wordLayout.js
 *
 * Phase A Layout Engine — Clean Code
 *
 * Responsibility:
 *   - Given words, a canvas, and a static layoutStyle,
 *     compute line breaks and on-screen geometry.
 *
 * Depends on:
 *   - layoutStyle.fontSize
 *   - layoutStyle.lineHeightMultiplier
 *   - layoutStyle.verticalOffset
 *   - layoutStyle.maxWidthMultiplier
 *
 * Must NOT:
 *   - read global styles
 *   - hardcode layout values
 *   - handle timing or animation
 *   - apply active styling
 *   - perform drawing
 *
 * WHY:
 *   Centralizes layout truth under StylePreset.
 *   Prevents renderer from owning geometric rules.
 *   Ensures deterministic behavior for future RenderPlan.
 */
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


        currentLine.items.push({
            word,
            wordIndex: words.indexOf(word)
        });

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


