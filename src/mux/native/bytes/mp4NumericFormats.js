/**
 * MP4 Numeric Format Helpers
 * ==========================
 *
 * This module documents and implements numeric *representation conventions*
 * used by the MP4 (ISO Base Media File Format) specification.
 *
 * These helpers do NOT read bytes from a buffer.
 * They do NOT know about offsets.
 * They do NOT perform traversal or validation.
 *
 * Instead, they operate on already-read numeric values and
 * interpret them according to MP4-defined encoding rules.
 *
 * ---------------------------------------------------------------------------
 * Why this module exists
 * ---------------------------------------------------------------------------
 *
 * The MP4 format frequently stores non-integer values using *fixed-point*
 * numeric representations rather than floating-point numbers.
 *
 * These encodings are:
 *   - historical (originating in QuickTime)
 *   - still required for structural validity
 *   - largely ignored by modern players
 *   - critical for byte-for-byte conformance
 *
 * JavaScript developers are NOT expected to know these conventions.
 * This module makes them explicit and discoverable.
 *
 * Keeping these helpers separate from raw byte readers prevents:
 *   - accidental semantic drift
 *   - mixing of "what the bytes are" with "what they mean"
 *   - duplication of subtle bit-level logic
 *
 * If you see code using bit shifts and masks elsewhere,
 * it likely belongs here instead.
 */

/**
 * Fixed 16.16 Numbers
 * ------------------
 *
 * A Fixed 16.16 number is a 32-bit unsigned integer that encodes
 * a fractional value using two components:
 *
 *   - High 16 bits  → integer component
 *   - Low 16 bits   → fractional component
 *
 * Conceptually:
 *
 *   fixedValue = integer + (fraction / 65536)
 *
 * Example:
 *
 *   width = 1920 pixels
 *   fraction = 0
 *
 *   fixedValue = (1920 << 16) | 0
 *
 * In MP4 files:
 *   - display width and height (tkhd)
 *   - transformation matrices
 *   - some audio-related fields
 *
 * Players typically ignore the fractional component for layout,
 * but encoders *do* emit it, and it *does* affect byte equivalence.
 *
 * Framesmith preserves these values verbatim.
 * It does not normalize or reinterpret them.
 */

/**
 * splitFixed1616
 * --------------
 *
 * Decomposes a 32-bit Fixed 16.16 value into its integer and
 * fractional components.
 *
 * This function is used when:
 *   - inspecting reference MP4 files
 *   - asserting semantic equivalence in tests
 *   - exposing human-readable values
 *
 * @param {number} value
 *   A 32-bit unsigned integer interpreted as Fixed 16.16
 *
 * @returns {{ integer: number, fraction: number }}
 *   integer  → high 16 bits (whole units)
 *   fraction → low 16 bits (fractional units)
 *
 * Notes:
 *   - No floating-point math is used
 *   - The fractional component is returned *as stored*, not scaled
 *   - Callers may divide fraction by 65536 if a float is required
 */
export function splitFixed1616(value) {
    return {
        integer: value >>> 16,
        fraction: value & 0xFFFF
    };
}

/**
 * makeFixed1616
 * -------------
 *
 * Constructs a 32-bit Fixed 16.16 value from integer and
 * fractional components.
 *
 * This function is used when:
 *   - building MP4 boxes
 *   - reconstructing values from parsed semantics
 *   - preserving byte-for-byte equivalence with reference files
 *
 * @param {number} integer
 *   Whole-unit component (0–65535)
 *
 * @param {number} fraction
 *   Fractional component (0–65535)
 *
 * @returns {number}
 *   A 32-bit unsigned integer encoding the Fixed 16.16 value
 *
 * Notes:
 *   - No validation is performed here
 *   - Callers are responsible for enforcing bounds
 *   - Fraction is masked to 16 bits to avoid overflow
 */
export function makeFixed1616(integer, fraction) {
    return (integer << 16) | (fraction & 0xFFFF);
}
