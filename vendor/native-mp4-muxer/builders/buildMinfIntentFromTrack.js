export function buildMinfIntentFromTrack({ track }) {
    const dinfIntent = { dref: {} };

    return {
        mediaHeader: {
            type: track.semanticTrackFamily === "audio" ? "smhd" : "vmhd"
        },
        dinf: dinfIntent,
        stbl: track.storedIntent.stblIntent
    };
}

