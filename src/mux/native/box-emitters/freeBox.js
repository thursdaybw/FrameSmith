/**
 * FREE — Free Space Box
 * ====================
 *
 * Purpose
 * -------
 * The `free` box is a padding box defined by the MP4 specification.
 * Its contents are ignored by decoders.
 *
 * It exists to:
 *   - reserve space for future edits
 *   - allow in-place rewriting
 *   - align subsequent boxes
 *
 * Encoders such as ffmpeg commonly emit a minimal `free` box
 * between `ftyp` and `mdat`.
 *
 * ----------------------------------------------------------------
 * Framesmith Canonical Form
 * ----------------------------------------------------------------
 *
 * Framesmith supports exactly ONE form:
 *
 *   - size: 8 bytes
 *   - type: "free"
 *   - no payload
 *
 * This matches ffmpeg’s default output and avoids introducing
 * layout policy into emitters.
 *
 * ----------------------------------------------------------------
 * Responsibilities
 * ----------------------------------------------------------------
 *
 * - Emit a valid MP4 `free` box
 * - Preserve deterministic layout
 *
 * ----------------------------------------------------------------
 * Non-responsibilities
 * ----------------------------------------------------------------
 *
 * - No variable padding
 * - No alignment policy
 * - No byte mutation
 * - No layout decisions
 */
function emitFreeBox() {
    return {
        type: "free",
    };
}

export function registerFreeEmitter(registry) {
    registry.registerEmitter(
        "free",
        emitFreeBox
    );
}
