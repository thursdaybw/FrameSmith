export function deriveSemanticTrackFamily(track) {

    const codec = track.semanticCore.codec.codec;

    if (codec.startsWith("mp4a") || codec === "opus") {
        return "audio";
    }

    return "video";
}
