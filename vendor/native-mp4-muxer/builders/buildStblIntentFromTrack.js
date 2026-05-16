export function buildStblIntentFromTrack({ track }) {

    if (!track.storedIntent.stsd) {
        throw new Error(
            "buildStblIntentFromTrack: track.storedIntent.stsd.missing"
        );
    }

    const stblIntent = {
        stsd: track.storedIntent.stsd,
        stts: track.storedIntent.sttsParams,
        stsc: track.storedIntent.stscParams,
        stsz: track.storedIntent.stszParams,
        stco: 
        track.storedIntent.stco ??
        {
            chunkOffsets: new Array(track.chunks.length).fill(0)
        },
    };

    if (track.hasNonZeroCompositionOffset) {
        stblIntent.ctts = track.storedIntent.cttsParams;
    }

    // ---------------------------------------------------------
    // Sync representation intent (already resolved)
    // ---------------------------------------------------------

    if (track.storedIntent.syncIntent) {
        Object.assign(stblIntent, track.storedIntent.syncIntent);
    }

    return stblIntent;
}
