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
    // t is seconds → convert to a looping percent 0–100
    const oscillation = ((Math.sin(t * 6) + 1) / 2) * 100;

    return {
      ...style,

      // Scale by percent (5% range)
      fontSize: getThePointAtPercentFromAtoB(
        oscillation,
        style.fontSize,
        style.fontSize * 1.05
      ),

      // Color shift toward #ffaa00
      highlightFill: getTheColorAtPercentFromAtoB(
        oscillation,
        style.highlightFill,
        "#ffaa00"
      )
    };
  }

};

