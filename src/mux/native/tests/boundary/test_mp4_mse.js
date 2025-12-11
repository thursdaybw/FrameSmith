import { buildTestMp4 } from "./helpers/buildTestMp4.js";

export async function test_mp4_mse() {
    console.log("=== boundary: test_mp4_mse ===");

    if (!("MediaSource" in window)) {
        console.warn("SKIP: Browser does not support MediaSource");
        return;
    }

    const { blob } = await buildTestMp4();

    const url = URL.createObjectURL(blob);

    const mediaSource = new MediaSource();
    const mseUrl = URL.createObjectURL(mediaSource);

    const video = document.createElement("video");
    video.src = mseUrl;

    const bufferPromise = new Promise(resolve => {
        mediaSource.addEventListener("sourceopen", () => {
            const reader = new FileReader();
            reader.onload = () => resolve(new Uint8Array(reader.result));
            reader.readAsArrayBuffer(blob);
        });
    });

    const bytes = await bufferPromise;

    const sb = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E"');

    sb.appendBuffer(bytes);

    await new Promise(resolve => {
        sb.onupdateend = () => {
            if (mediaSource.readyState === "open") {
                mediaSource.endOfStream();
            }
            resolve();
        };
    });

    console.log("PASS: MSE accepted MP4 buffer");
}
