import { extractTrackDataForNativeDemux } from '../track/extractTrackDataForNativeDemux.js';
import { ContainerTrackView } from './ContainerTrackView.js';

export function createContainerTrackViewFromMp4({ mp4Bytes, trackIndex }) {

    const trackData = extractTrackDataForNativeDemux({ mp4Bytes, zeroBasedTrackIndex: trackIndex });

    return new ContainerTrackView({
        mediaType: trackData.type,
        containerMeta: trackData.container,
        codecConfig: trackData.codecConfig,
        semanticSamples: trackData.accessUnits,
        mp4Bytes
    });
}
