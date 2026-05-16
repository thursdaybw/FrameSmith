/**
 * TKHD Adapter — Semantic → Structural
 *
 * Converts semantic track metadata into tkhd builder input.
 */
export function adaptTkhdFromTrackMetadata(trackMetadata) {
    if (!trackMetadata) {
        throw new Error("adaptTkhdFromTrackMetadata: trackMetadata is required");
    }

    return {
        trackId: trackMetadata.trackId,
        duration: trackMetadata.duration ?? 0,

        width: trackMetadata.width,
        height: trackMetadata.height,

        // Fixed-point 16.16 fractions
        widthFraction: 0,
        heightFraction: 0,

        layer: 0,
        alternateGroup: 0,
        volume: 0,

        // Identity matrix (standard)
        matrix: [
            0x00010000, 0, 0,
            0, 0x00010000, 0,
            0, 0, 0x40000000
        ]
    };
}
