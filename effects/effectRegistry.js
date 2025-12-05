/**
 * Effect Registry (Functional Seam)
 *
 * This registry maps effect names to effect functions.
 * Each effect takes a style and returns a modified style.
 *
 * This establishes the architectural extension point for:
 * - typewriter effects
 * - slide-up caption regions
 * - emoji bursts
 * - storyteller single-word modes
 * - bounding boxes
 * - future animation-effect interactions
 *
 * MVP behavior:
 * Only "default" is registered, pointing to activeWordEffect.
 */

import { activeWordEffect } from "./activeWordEffect.js";

export const activeEffects = {
  default: activeWordEffect
};

