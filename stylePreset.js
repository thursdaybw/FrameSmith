/**
 * Static style presets and resolution.
 *
 * Responsibility:
 *   - Define appearance defaults
 *   - Apply preset + override hierarchy
 *
 * Does NOT:
 *   - Handle animations
 *   - Compute layout
 *   - Draw to canvas
 *
 * Layout-related fields:
 *   - lineHeightMultiplier → vertical spacing between lines
 *   - verticalOffset → padding from bottom of canvas
 *   - maxWidthMultiplier → maximum line width relative to canvas
 *
 * WHY:
 *   These values define geometry but do NOT compute geometry.
 *   The layout engine reads these values and performs the math.
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

    const out = { ...base };

    for (const override of applied) {
        for (const key in override) {
            // Only copy defined values
            if (override[key] !== undefined) {
                out[key] = override[key];
            }
        }
    }

    return out;
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

