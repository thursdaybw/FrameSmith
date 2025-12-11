export async function createFrames(width, height) {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "red";
    ctx.fillRect(0, 0, width, height);
    const f1 = new VideoFrame(canvas, { timestamp: 0 });

    ctx.fillStyle = "green";
    ctx.fillRect(0, 0, width, height);
    const f2 = new VideoFrame(canvas, { timestamp: 33333 });

    return [f1, f2];
}

