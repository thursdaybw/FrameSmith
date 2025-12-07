/**
 * RenderPlanRenderer (Phase A — Global Compositor)
 *
 * Responsibility:
 *   - Composite the full frame:
 *       1. Video frame
 *       2. Overlay nodes (e.g., images)
 *       3. Captions (delegated to captionRenderer)
 *
 * Does NOT:
 *   - Perform layout
 *   - Modify caption styles
 *   - Resolve animations (except temporary overlay pulse)
 *   - Interpret semantic intent
 *
 * Temporary Phase A Note:
 *   The overlay pulse animation exists here ONLY until the unified
 *   animation dispatcher is introduced in Phase B.
 */

import { drawCaptionForTime } from "../captionRenderer.js";

export function renderFrame({
  videoFrame,
  renderPlan,
  captions,
  context,
  canvas,
  t
}) {
  // 1. Draw video frame
  if (videoFrame) {
    context.drawImage(videoFrame, 0, 0, canvas.width, canvas.height);
  }

  // 2. Draw overlay nodes
  if (renderPlan && renderPlan.elements) {
    for (const node of renderPlan.elements) {
      if (node.type === "image") {
        const { image, x, y, width, height } = node.props;

        // --- Phase A Temporary Overlay Pulse Animation ---
        const pulse = 0.05 * Math.sin(t * 4);
        const scale = 1 + pulse;

        const drawW = width * scale;
        const drawH = height * scale;

        const offsetX = x - (drawW - width) / 2;
        const offsetY = y - (drawH - height) / 2;

        context.drawImage(image, offsetX, offsetY, drawW, drawH);
      }
    }
  }

  // 3. Draw captions (delegated)
  drawCaptionForTime(t, context, canvas, captions, "default");
}

