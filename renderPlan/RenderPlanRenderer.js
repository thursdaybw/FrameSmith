/**
 * RenderPlanRenderer (Phase A — Global Compositor)
 *
 * Responsibility:
 *   - Composite the full frame:
 *       1. Video frame
 *       2. Overlay nodes (e.g., images)
 *       3. TextOverlays (delegated to textOverlaysRenderer)
 *
 * Does NOT:
 *   - Perform layout
 *   - Modify text-overlay styles
 *   - Resolve animations (except temporary overlay pulse)
 *   - Interpret semantic intent
 *
 * Temporary Phase A Note:
 *   The overlay pulse animation exists here ONLY until the unified
 *   animation dispatcher is introduced in Phase B.
 */

import { drawTextOverlayForTime } from "../textOverlayRenderer.js";

export function renderFrame({
  videoFrame,
  renderPlan,
  textOverlays,
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

                // base pixel size
                const baseW = width * canvas.width;

                let baseH;
                if (height != null) {
                    baseH = height * canvas.height;
                } else {
                    const aspect = image.naturalHeight / image.naturalWidth;
                    baseH = baseW * aspect;
                }

                // apply pulse in pixel space
                const drawW = baseW * scale;
                const drawH = baseH * scale;

                // center-scale around original position
                const px = (x * canvas.width) - (drawW - baseW) / 2;
                const py = (y * canvas.height) - (drawH - baseH) / 2;

                context.drawImage(image, px, py, drawW, drawH);

            }
        }
    }

    // 3. Draw text-overlays (delegated)
    drawTextOverlayForTime(t, context, canvas, textOverlays, "default");
}

