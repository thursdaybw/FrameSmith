/**
 * muxToMp4.js
 *
 * Minimal muxer.
 * Converts an array of WebCodecs EncodedVideoChunk objects
 * into a valid MP4 initialization segment + media segments.
 */

// Phase A MP4 mux placeholder.
// We simply concatenate encoded chunks into a Blob.
// MP4Box muxing will replace this in Phase B.

export function muxToMp4(encodedChunks) {
    const buffers = [];

    for (const chunk of encodedChunks) {
        const buf = new Uint8Array(chunk.byteLength);
        new Uint8Array(chunk.data).forEach((v, i) => buf[i] = v);
        buffers.push(buf);
    }

    return new Blob(buffers, { type: "video/mp4" });
}

