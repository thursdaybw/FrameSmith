import { buildTestMp4 } from "./helpers/buildTestMp4.js";

export async function test_mp4_playback() {
    console.log("=== boundary: test_mp4_playback ===");

    const { blob } = await buildTestMp4();
    console.log("PLAYBACK TEST: MP4 built. Blob size =", blob.size);

    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.src = url;

    await video.play().catch(() => {}); // Some browsers block auto-play

    await new Promise(resolve => {
        video.onloadeddata = () => resolve();
    });

    console.log("PASS: Video element accepted MP4 and loaded data");
}
