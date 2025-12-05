/**
 * Animation behaviors registry.
 *
 * Responsibility:
 *   - Provide pure functions: (style, t) → style
 *
 * Does NOT:
 *   - Know layout
 *   - Interact with presets
 *   - Mutate state
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

            // Color pulse applied to FILL
            fill: getTheColorAtPercentFromAtoB(
                oscillation,
                style.fill,
                "#ffaa00"
            )
        };
    }


};

