import { requireCodecProfileByCodecName } from "../codecs/codecRegistry.js";

export function deriveSemanticTrackFamily(track) {
    const codec = track.semanticCore.codec.codec;
    const profile = requireCodecProfileByCodecName(
        codec,
        "deriveSemanticTrackFamily"
    );
    return profile.mediaFamily;
}
