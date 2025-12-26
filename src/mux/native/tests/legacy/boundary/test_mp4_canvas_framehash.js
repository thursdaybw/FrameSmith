import { buildTestMp4 } from "./helpers/buildTestMp4.js";

export async function test_mp4_canvas_framehash() {
    console.log("=== boundary: test_mp4_canvas_framehash ===");

    const { blob } = await buildTestMp4();

    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.src = url;

    await new Promise(resolve => {
        video.onloadeddata = () => resolve();
    });

    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    const pixels = ctx.getImageData(0, 0, 64, 64).data;

    // Compute a simple hash for integrity
    let hash = 0;
    for (let i = 0; i < pixels.length; i++) {
        hash = (hash + pixels[i]) % 1000000;
    }

    console.log("PASS: Canvas read succeeded. Frame hash =", hash);
}
