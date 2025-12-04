/**
 * STYLE PRESET SYSTEM — PHASE A
 * ------------------------------
 * Purpose:
 *   Provide a stable place where all visual appearance lives:
 *     - fonts
 *     - colors
 *     - outlines
 *     - padding
 *     - highlight colors
 *
 * Why now?
 *   The renderer must NOT own appearance.
 *   StylePreset allows the caption system to evolve without
 *   breaking export or layout.
 *
 * Future (Phase B):
 *   - Inline overrides per caption or per word
 *   - Animated styles (pulsing logo, fades)
 *   - Style inheritance trees
 *   - Resolution-aware scaling
 *
 * One-way door rule:
 *   Once export exists, style must be stable.
 *   So we establish this contract now—before export.
 */


// PHASE A: Minimal preset table
export const stylePreset = {
  default: {
    fontFamily: "Arial",
    fontSize: 40,
    fill: "#ffffff",
    stroke: "#000000",
    highlightFill: "#ffde59",
    maxWidthMultiplier: 0.8,
    verticalOffset: 80,
    lineHeightMultiplier: 1.3
  },

  // Example override: a pulsing highlight color
  pulse: {
    highlightFill: "#ffaa00"
  },

  muted: {
    fill: "#aaaaaa"
  }
};

/**
 * Resolve a base style + an array of override names
 */
export function resolveStyle(presetName, overrides = []) {
  const base = stylePreset[presetName] || stylePreset.default;

  const applied = overrides
    .map(name => stylePreset[name])
    .filter(Boolean);

  return Object.assign({}, base, ...applied);
}

/**
 * getStyle(presetName)
 * ---------------------
 * Returns a frozen style object so no code mutates global presets.
 * (Mutation leaks across frames and breaks renderer determinism.)
 */
export function getStyle(presetName = "default") {
  const style = StylePreset[presetName] || StylePreset.default;
  return Object.freeze({ ...style });
}

