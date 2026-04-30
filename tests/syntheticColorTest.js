
// Utility: save blob to disk without relying on your system
function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export async function runSyntheticColorTest() {
    const width = 320;
    const height = 240;
    const fps = 30;
    const frameCount = 30;

    const frameDuration = 1_000_000 / fps;
    let timestamp = 0;

    // Canvas source for guaranteed-valid frames
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    // Cycle colors so jitter is visible
    const colors = ["red", "green", "blue", "yellow", "magenta", "cyan"];

    const encodedNALUnits = [];

    const encoder = new VideoEncoder({
        output(chunk) {
            const u8 = new Uint8Array(chunk.byteLength);
            chunk.copyTo(u8);
            encodedNALUnits.push(u8);
        },
        error(e) {
            console.error("Encoder error:", e);
        }
    });

    encoder.configure({
        codec: "avc1.42E01E",
        width,
        height,
        framerate: fps
    });

    // Generate frames
    for (let i = 0; i < frameCount; i++) {
        ctx.fillStyle = colors[i % colors.length];
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const frame = new VideoFrame(canvas, { timestamp });
        encoder.encode(frame);
        frame.close();

        timestamp += frameDuration;
    }

    await encoder.flush();
    encoder.close();

    // Raw H.264 elementary stream
    const blob = new Blob(encodedNALUnits, { type: "video/h264" });

    saveBlob(blob, "color_test.h264");
}
