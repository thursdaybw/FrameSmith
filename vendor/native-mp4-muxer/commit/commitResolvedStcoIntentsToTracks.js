import { adaptStcoIntentFromOffsets } from "../adapters/adaptStcoIntentFromOffsets.js";

export function commitResolvedStcoIntentsToTracks({ tracks, perTrackStcoOffsets }) {
    for (let i = 0; i < tracks.length; i++) {
        tracks[i].storedIntent.stco = adaptStcoIntentFromOffsets({
                chunkOffsets: perTrackStcoOffsets[i]
            });
    }
}
