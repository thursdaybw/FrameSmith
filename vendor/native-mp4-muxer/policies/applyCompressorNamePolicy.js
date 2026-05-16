/**
 * applyCompressorNamePolicy
 * =========================
 *
 * Container policy for selecting the SampleEntry compressor name
 * stored in stsd (e.g. avc1 SampleEntry).
 *
 * -------------------------------------------------------------------------
 * PURPOSE
 * -------------------------------------------------------------------------
 *
 * The compressor name:
 *   - is NOT a semantic media fact
 *   - is NOT derivable from samples
 *   - is NOT required for decoding
 *
 * It is a representational, encoder-chosen string that exists for
 * human inspection, debugging, and tooling compatibility.
 *
 * Different encoders choose different values.
 *
 * This policy makes that choice explicit.
 *
 * -------------------------------------------------------------------------
 * Observed ffmpeg behavior
 * -------------------------------------------------------------------------
 *
 * ffmpeg writes a non-empty compressor name, typically of the form:
 *
 *   "Lavc<version> <encoder>"
 *
 * Example:
 *   "Lavc61.19.101 libx264"
 *
 * This value:
 *   - affects stsd byte layout
 *   - affects file size
 *   - does NOT affect playback
 *
 * -------------------------------------------------------------------------
 * Policy Decision
 * -------------------------------------------------------------------------
 *
 * Priority order:
 *
 *   1. If a compressorName is supplied via buildHints,
 *      use it verbatim.
 *
 *   2. Otherwise, fall back to a stable, explicit default
 *      that produces a valid MP4.
 *
 * The default is NOT meant to impersonate ffmpeg.
 * It is meant to be:
 *   - deterministic
 *   - non-empty
 *   - standards-conformant
 *
 * -------------------------------------------------------------------------
 * Architectural Classification
 * -------------------------------------------------------------------------
 *
 * This logic is:
 *   - NOT normalization
 *   - NOT derivation
 *   - NOT adaptation
 *
 * It IS a container policy.
 *
 * -------------------------------------------------------------------------
 * Inputs
 * -------------------------------------------------------------------------
 *
 * @param {Object} params
 * @param {string | undefined} params.compressorName
 *
 * -------------------------------------------------------------------------
 * Output
 * -------------------------------------------------------------------------
 *
 * @returns {string}
 *   Compressor name to be written into stsd SampleEntry.
 */
export function applyCompressorNamePolicy({ compressorName }) {

    // ---------------------------------------------------------
    // Use oracle-provided value if present
    // ---------------------------------------------------------
    if (typeof compressorName === "string") {
        return compressorName;
    }

    // ---------------------------------------------------------
    // Explicit default (deterministic, non-empty)
    // ---------------------------------------------------------
    return "NativeMuxer";
}
