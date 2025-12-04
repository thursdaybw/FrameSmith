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

import { activeWordEffect } from "./effects/activeWordEffect.js";

export function resolveActiveStyle(style, isActive) {
  if (!isActive) return style;

  // Phase A: appearance decided by the effect system
  return activeWordEffect(style);
}

