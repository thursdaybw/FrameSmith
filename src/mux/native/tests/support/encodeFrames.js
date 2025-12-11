export async function encodeFrames(frames, config) {
    const chunks = [];

    const encoder = new VideoEncoder({
        output(chunk) { chunks.push(chunk); },
        error(e) { throw e; }
    });

    encoder.configure(config);

    for (const f of frames) encoder.encode(f);
    await encoder.flush();

    frames.forEach(f => f.close());
    return chunks;
}

