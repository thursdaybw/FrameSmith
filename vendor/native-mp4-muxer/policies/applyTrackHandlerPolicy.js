/**
 * applyTrackHandlerPolicy
 * =======================
 *
 * Declares the MP4 Handler Reference (hdlr) parameters for a track.
 *
 * This is a CONTAINER POLICY.
 * It does not derive data and does not encode boxes.
 *
 * It exists to:
 *   - declare handler intent explicitly
 *   - encode project roadmap knowledge
 *   - provide a single, documented seam for future audio support
 *
 * -------------------------------------------------------------------------
 * Current behaviour
 * -------------------------------------------------------------------------
 *
 * video:
 *   - supported
 *   - handlerType = "vide"
 *   - nameBytes   = "VideoHandler\0" (UTF-8, null-terminated)
 *
 * audio:
 *   - planned
 *   - NOT YET IMPLEMENTED
 *   - throws loudly with an explicit message
 *
 * all other track types:
 *   - unsupported
 *   - not planned
 *   - throws loudly with a different message
 */
export function applyTrackHandlerPolicy({ trackType }) {

    if (trackType === "video") {
        return {
            handlerType: "vide",
            nameBytes: new TextEncoder().encode("VideoHandler\0")
        };
    }

    if (trackType === "audio") {
        throw new Error(
            "applyTrackHandlerPolicy: audio tracks are planned but not yet supported"
        );
    }

    throw new Error(
        `applyTrackHandlerPolicy: trackType '${trackType}' is unsupported and not planned`
    );
}
