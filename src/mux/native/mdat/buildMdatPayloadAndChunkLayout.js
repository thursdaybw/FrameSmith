import { gatherTrackMdatFactsFromChunks } from "../mdat/gatherTrackMdatFactsFromChunks.js";

/**
 * Build the final MDAT payload by concatenating chunks
 * using the proven FFmpeg global chunk ordering policy:
 *
 * - audio track first
 * - video track second
 * - interleave strictly by chunkIndex
 */
export function buildMdatPayloadAndChunkLayout({ mp4CompilerState }) {

    const videoTrackIndex = 0;
    const audioTrackIndex = 1;

    const videoTrack = mp4CompilerState.tracks[videoTrackIndex];
    const audioTrack = mp4CompilerState.tracks[audioTrackIndex];

    const videoFacts = gatherTrackMdatFactsFromChunks({
        accessUnitGroups: videoTrack.chunks,
        accessUnitPayloads: videoTrack.payloads.accessUnitPayloads
    });

    const audioFacts = gatherTrackMdatFactsFromChunks({
        accessUnitGroups: audioTrack.chunks,
        accessUnitPayloads: audioTrack.payloads.accessUnitPayloads
    });

    const videoChunks = videoFacts.chunks;
    const audioChunks = audioFacts.chunks;

    const maxChunks = Math.max(videoChunks.length, audioChunks.length);

    // ---------------------------------------------------------
    // Interleave by chunkIndex: audio first, then video
    // ---------------------------------------------------------
    const orderedChunks = [];

    for (let i = 0; i < maxChunks; i++) {

        if (i < audioChunks.length) {
            orderedChunks.push({
                trackIndex: audioTrackIndex,
                bytes: audioChunks[i].bytes
            });
        }

        if (i < videoChunks.length) {
            orderedChunks.push({
                trackIndex: videoTrackIndex,
                bytes: videoChunks[i].bytes
            });
        }

    }

    // ---------------------------------------------------------
    // Build payload + layout together
    // ---------------------------------------------------------
    let totalByteCount = 0;
    for (const chunk of orderedChunks) {
        totalByteCount += chunk.bytes.length;
    }

    const mdatPayload = new Uint8Array(totalByteCount);
    const mdatChunkLayout = [];

    let writeOffset = 0;

    for (let i = 0; i < orderedChunks.length; i++) {

        const { trackIndex, bytes } = orderedChunks[i];

        mdatPayload.set(bytes, writeOffset);

        mdatChunkLayout.push({
            trackIndex,
            chunkIndex: i,
            offsetWithinMdat: writeOffset,
            byteLength: bytes.length,
            bytes
        });

        writeOffset += bytes.length;
    }

    return {
        mdatPayload,
        mdatChunkLayout
    };
}
