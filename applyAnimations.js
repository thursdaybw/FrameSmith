/**
 * Animation application layer.
 *
 * Responsibility:
 *   - Apply animation behaviors to resolved styles.
 *
 * Inputs:
 *   - Base style
 *   - Time (seconds)
 *   - Animation names
 *
 * Does NOT:
 *   - Modify layout geometry
 *   - Know rendering or canvas rules
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

