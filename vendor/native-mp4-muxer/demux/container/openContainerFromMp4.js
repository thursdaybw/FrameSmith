import { listTracksFromMp4 } from "./listTracksFromMp4.js";
import { extractTrackDataForNativeDemux } from "../track/extractTrackDataForNativeDemux.js";
import { ContainerTrackView } from "../trackview/ContainerTrackView.js";

export function openContainerFromMp4({ mp4Bytes }) {
    if (!(mp4Bytes instanceof Uint8Array)) {
        throw new Error("openContainerFromMp4: mp4Bytes must be Uint8Array");
    }

    const tracks = listTracksFromMp4({ mp4Bytes });
    const trackViewCache = new Map();

    function createTrackViewInternal({ trackIndex }) {
        if (trackViewCache.has(trackIndex)) {
            return trackViewCache.get(trackIndex);
        }

        const trackData = extractTrackDataForNativeDemux({
            mp4Bytes,
            zeroBasedTrackIndex: trackIndex
        });

        const view = new ContainerTrackView({
            mediaType: trackData.type,
            containerMeta: trackData.container,
            codecConfig: trackData.codecConfig,
            semanticSamples: trackData.accessUnits,
            mp4Bytes
        });

        trackViewCache.set(trackIndex, view);
        return view;
    }

    return {
        listTracks() {
            return tracks.slice();
        },
        createTrackView({ trackIndex }) {
            return createTrackViewInternal({ trackIndex });
        },
        createTrackViews({ mediaType } = {}) {
            const all = tracks.map((trackInfo) =>
                createTrackViewInternal({ trackIndex: trackInfo.zeroBasedTrackIndex })
            );
            if (typeof mediaType !== "string" || mediaType.length === 0) {
                return all;
            }
            return all.filter((trackView) => trackView.mediaType === mediaType);
        }
    };
}
