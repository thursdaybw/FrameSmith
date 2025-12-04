/**
 * ANIMATION REGISTRY — PHASE A
 * ----------------------------
 * Purpose:
 *   - Define animation "behaviors" as pure functions.
 *   - Each behavior receives the resolved static style and
 *     returns a NEW style with animated values applied.
 *
 * Architecture:
 *   - No knowledge of captions, layout, or rendering.
 *   - Pure functional transforms.
 *   - Time-based, deterministic.
 */

import {
  getThePointAtPercentFromAtoB,
  getTheColorAtPercentFromAtoB
} from "./mathUtils.js";

/**
 * ANIMATION REGISTRY
 */
export const animations = {

    pulse: (style, t) => {
        // Oscillates 0–100 percent
        const oscillation = ((Math.sin(t * 6) + 1) / 2) * 100;

        return {
            ...style,

            // Slight scale animation
            fontSize: getThePointAtPercentFromAtoB(
                oscillation,
                style.fontSize,
                style.fontSize * 1.05
            ),

            // Color pulse applied to FILL, not highlightFill
            fill: getTheColorAtPercentFromAtoB(
                oscillation,
                style.fill,
                "#ffaa00"
            )
        };
    }


};

