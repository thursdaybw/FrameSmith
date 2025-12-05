/**
 * Active Style Resolver (Phase A)
 *
 * Responsibility:
 *   - Define how a word's style changes when it is the active (spoken) word.
 *
 * Does NOT:
 *   - Determine *when* a word is active (renderer does timing)
 *   - Know rendering logic
 *   - Choose highlight behavior beyond using existing style attributes
 *   - Perform layout or animation
 *   - Apply visual rules not defined by StylePreset
 *
 * WHY:
 *   Moves highlight-style decision OUT of renderer.
 *   Renderer becomes a mechanical drawer with no appearance logic.
 */

import { activeEffects } from "./effects/effectRegistry.js";

/**
 * resolveActiveStyle(style, isActive)
 *
 * Determines which style to apply to an active word.
 * Delegates to the effect registry, ensuring extensibility.
 */
export function resolveActiveStyle(style, isActive) {
  if (!isActive) return style;

  // Phase A: appearance decided by the effect system
  // MVP: always use "default" effect
  const effectFn = activeEffects.default;
  return effectFn(style);
}

