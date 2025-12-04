/**
 * APPLY ANIMATIONS — PHASE A
 * ---------------------------
 * Purpose:
 *   Take a resolved style object and a list of animation names,
 *   and return a NEW style with time-based transforms applied.
 *
 * Contract:
 *   (style, time, overrides[]) → animatedStyle
 */

import { animations } from "./animationRegistry.js";

export function applyAnimations(style, t, overrideNames = []) {
  let out = { ...style };

  for (const name of overrideNames) {
    const fn = animations[name];
    if (fn) {
      out = fn(out, t);
    }
  }

  return out;
}

