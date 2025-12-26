import { NativeMuxer } from "../../NativeMuxer.js";

/* Must rename this to reflect the playback nature of it */
export async function test_webcodecs_decode() {
    console.log("=== boundary: test_webcodecs_decode (MP4 playback test) ===");

    // SPS + PPS from real encoder
    const spspps = new Uint8Array([
        0x00,0x00,0x00,1, 0x67,0x42,0xC0,0x0B,0x8C,0x68,0x42,0x49,0xA8,0x08,0x08,0x08,0x3C,0x22,0x11,0xA8,
        0x00,0x00,0x00,1, 0x68,0xCE,0x3C,0x80
    ]);

    const muxer = new NativeMuxer({
        codec: "avc1.42E01E",
        width: 64,
        height: 64,
        fps: 30
    });

    muxer.addVideoFrame({
        timestamp: 0,
        duration: 33333,
        byteLength: spspps.length,
        copyTo: out => out.set(spspps)
    });

    const blob = await muxer.finalize();
    console.log("MP4 created. Blob size =", blob.size);

    // Video element used as decoder
    const video = document.createElement("video");
    video.muted = true;
    video.src = URL.createObjectURL(blob);

    await new Promise((resolve, reject) => {
        video.addEventListener("loadeddata", resolve, { once: true });
        video.addEventListener("error", (e) => {
            reject(new Error("Video failed to load MP4: " + e.message));
        }, { once: true });
    });

    console.log("PASS: Browser loaded MP4");

    // Optional: draw first frame to canvas
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    console.log("PASS: Canvas drawImage succeeded");

    return true;
}
