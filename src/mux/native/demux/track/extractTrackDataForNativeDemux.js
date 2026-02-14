import { extractSemanticAccessUnitsFromMp4 } from "../container/extractSemanticAccessUnitsFromMp4.js";
import { extractTrackCodecConfigurationFromMp4 } from "../container/extractTrackCodecConfigurationFromMp4.js";
import { extractTrackContainerMetadataFromMp4 } from "../container/extractTrackContainerMetadataFromMp4.js";
import { requireCodecProfileByCodecName } from "../../codecs/codecRegistry.js";

/**
 * extractTrackDataForNativeDemux
 *
 * Contract (this stage):
 * - Returns container metadata + codec config + a semantic sample table.
 * - Semantic samples contain timing plus byte addressing:
 *     { pts, dts, duration, offset, size, isKey }
 * - Does NOT slice payload bytes.
 *
 * Payload bytes are read lazily later by ContainerTrackView using:
 *   mp4Bytes.slice(offset, offset + size)
 */
export function extractTrackDataForNativeDemux({ mp4Bytes, zeroBasedTrackIndex }) {
    try {
        const semanticAccessUnits =
            extractSemanticAccessUnitsFromMp4({ mp4Bytes, zeroBasedTrackIndex });

        const codecConfig =
            extractTrackCodecConfigurationFromMp4({
                mp4Bytes,
                zeroBasedTrackIndex
            });

        const containerMetadata =
            extractTrackContainerMetadataFromMp4({ mp4Bytes, zeroBasedTrackIndex });

        const codecProfile = requireCodecProfileByCodecName(
            codecConfig.codec,
            "extractTrackDataForNativeDemux"
        );
        const trackType = codecProfile.mediaFamily;

        // IMPORTANT: semantic-only, no payload slicing here.
        const accessUnits = semanticAccessUnits.map(s => ({
            pts: s.pts,
            dts: s.dts,
            duration: s.duration,
            offset: s.offset,
            size: s.size,
            isKey: trackType === "video" ? !!s.isKey : false
        }));

        return {
            type: trackType,
            container: containerMetadata,
            accessUnits,
            codecConfig
        };
    } catch (error) {
        console.error("Error extracting track data:", error);
        throw error;
    }
}
