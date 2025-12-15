/**
 * pasp — Pixel Aspect Ratio Box
 * -----------------------------
 * This box specifies the ratio of horizontal to vertical spacing
 * between pixels.
 *
 * Why this exists:
 * ----------------
 * Historically, many video formats used non-square pixels
 * (for example: PAL, NTSC, anamorphic video).
 *
 * Rather than baking pixel shape into the codec bitstream,
 * MP4 stores this information at the container level.
 *
 * Modern usage:
 * -------------
 * Modern digital video almost always uses square pixels.
 * As a result, ffmpeg and most modern encoders emit:
 *
 *   hSpacing = 1
 *   vSpacing = 1
 *
 * Even though most players ignore this box today,
 * it is commonly present in real-world MP4 files and
 * required for strict byte-for-byte conformance.
 *
 * Structure:
 * ----------
 *   unsigned int(32) hSpacing
 *   unsigned int(32) vSpacing
 *
 * This is NOT a FullBox:
 * - no version
 * - no flags
 */
export function buildPaspBox({ hSpacing = 1, vSpacing = 1 } = {}) {

    // ---------------------------------------------------------------------
    // Defensive validation — Category B (shape + sanity only)
    // ---------------------------------------------------------------------

    if (!Number.isInteger(hSpacing) || hSpacing < 0) {
        throw new Error(
            "buildPaspBox: hSpacing must be a non-negative integer"
        );
    }

    if (!Number.isInteger(vSpacing) || vSpacing < 0) {
        throw new Error(
            "buildPaspBox: vSpacing must be a non-negative integer"
        );
    }

    return {
        type: "pasp",
        body: [
            /**
             * hSpacing (uint32)
             * -----------------
             * Horizontal pixel spacing.
             *
             * Represents the width of a pixel relative to vSpacing.
             *
             * A value of 1 indicates square pixels when paired
             * with vSpacing = 1.
             */
            { int: hSpacing },

            /**
             * vSpacing (uint32)
             * -----------------
             * Vertical pixel spacing.
             *
             * Represents the height of a pixel relative to hSpacing.
             *
             * A value of 1 indicates square pixels when paired
             * with hSpacing = 1.
             */
            { int: vSpacing }
        ]
    };
}
