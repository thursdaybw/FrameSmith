// mathUtils.js

/**
 * Convert percent (0–100) to normalized t (0–1)
 */
function normalizePercent(percent) {
  return Math.min(Math.max(percent / 100, 0), 1);
}

/**
 * Numeric interpolation: find the value at this percent from A to B.
 */
export function getThePointAtPercentFromAtoB(percent, a, b) {
  const t = normalizePercent(percent);
  return a + (b - a) * t;
}

/**
 * Color interpolation: find the hex color at this percent from A to B.
 */
export function getTheColorAtPercentFromAtoB(percent, hexA, hexB) {
  const t = normalizePercent(percent);

  const a = parseInt(hexA.replace("#", ""), 16);
  const b = parseInt(hexB.replace("#", ""), 16);

  const rA = (a >> 16) & 255, gA = (a >> 8) & 255, bA = a & 255;
  const rB = (b >> 16) & 255, gB = (b >> 8) & 255, bB = b & 255;

  const r = getThePointAtPercentFromAtoB(t * 100, rA, rB) | 0;
  const g = getThePointAtPercentFromAtoB(t * 100, gA, gB) | 0;
  const bl = getThePointAtPercentFromAtoB(t * 100, bA, bB) | 0;

  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, "0")}`;
}

