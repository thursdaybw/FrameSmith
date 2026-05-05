/**
 * resolveStcoOffsetsPerTrack
 * =========================
 *
 * PURPOSE
 * -------
 * Work out where each track’s chunks start in the final MP4 file.
 *
 * We already know:
 * - where the MDAT box starts in the file
 * - where each chunk starts inside the MDAT box
 * - which track each chunk belongs to
 *
 * This function simply adds those together.
 *
 * Nothing is inferred.
 * Nothing is guessed.
 * Nothing is derived.
 *
 * This is layout resolution only.
 */
import { getPayloadOffsetForPath } from "../box-schema/boxSchemas.js";

export function resolveStcoOffsetsPerTrack({ tracks, mdatChunkLayout, mdatStartOffset }) {
    const offsetsPerTrack = tracks.map(() => []);

    const mdatPayloadOffset = getPayloadOffsetForPath("mdat"); // ← 8

    for (const chunk of mdatChunkLayout) {
        const absoluteOffset = mdatStartOffset + mdatPayloadOffset + chunk.offsetWithinMdat;
        offsetsPerTrack[chunk.trackIndex].push(absoluteOffset);
    }

    return offsetsPerTrack;
}

