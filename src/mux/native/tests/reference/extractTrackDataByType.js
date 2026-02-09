import { extractTrackDataForNativeDemux } from './extractTrackDataForNativeDemux.js';
import { extractTrackCodecConfigurationFromMp4UsingZeroBasedTrackIndex } from './extractTrackCodecConfigurationFromMp4UsingZeroBasedTrackIndex.js';

export function extractTrackDataByType({ mp4Bytes, trackType }) {
    // Loop through the tracks by index and find the matching type
    let trackIndex = -1;

    // Check the codec for each track (video or audio)
    for (let i = 0; i < 2; i++) {  // Assuming two tracks, video and audio
        const codecConfig = extractTrackCodecConfigurationFromMp4UsingZeroBasedTrackIndex({
            mp4Bytes,
            zeroBasedTrackIndex: i
        });

        // If the track is video and type is video
        if (
            trackType === 'video' &&
            (codecConfig.codec === 'avc1' || codecConfig.codec === 'hvc1')
        ) {
            trackIndex = i;
            break;
        }

        // If the track is audio and type is audio
        if (trackType === 'audio' && ['mp4a', 'opus'].includes(codecConfig.codec)) {
            trackIndex = i;
            break;
        }
    }

    if (trackIndex === -1) {
        throw new Error(`No track found with type: ${trackType}`);
    }


    // Now call the original function with the trackIndex
    const track = extractTrackDataForNativeDemux({ mp4Bytes, zeroBasedTrackIndex: trackIndex});
    return track;
}

