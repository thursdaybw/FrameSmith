import { MediabunnyMuxer } from "./mediabunny/MediabunnyMuxer.js";

export async function runTest() {

    console.log("=== WebCodecs → Mediabunny → MP4 Test ===");

    console.log("H264 avc =", await VideoEncoder.isConfigSupported({
        codec: "avc",
        width: 320,
        height: 240,
        bitrate: 500_000,
        framerate: 30
    }));

    console.log("H264 avc1 =", await VideoEncoder.isConfigSupported({
        codec: "avc1.42E01E",
        width: 320,
        height: 240,
        bitrate: 500_000,
        framerate: 30
    }));

    const encoded = [];

    const encoder = new VideoEncoder({
        output(chunk) { encoded.push(chunk); },
        error(e) { console.error(e); }
    });

    const CONFIG = {
       // codec: "avc1.42E01E",
        codec: "avc",
        width: 320,
        height: 240,
        bitrate: 500_000,
        framerate: 30
    };

    //encoder.configure(CONFIG);
    encoder.configure({
        codec: "avc1.42E01E",
        width: CONFIG.width,
        height: CONFIG.height,
        bitrate: CONFIG.bitrate,
        framerate: CONFIG.framerate,
        hardwareAcceleration: "prefer-software"
    });

    for (let i = 0; i < 3; i++) {
        const canvas = new OffscreenCanvas(CONFIG.width, CONFIG.height);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = ["red","green","blue"][i];
        ctx.fillRect(0,0, CONFIG.width, CONFIG.height);

        const frame = new VideoFrame(canvas, {
            timestamp: i * (1_000_000 / CONFIG.framerate)
        });

        encoder.encode(frame);
        frame.close();
    }

    await encoder.flush();

    const muxer = new MediabunnyMuxer({
        width: CONFIG.width,
        height: CONFIG.height,
        fps: CONFIG.framerate,
        codec: "avc"
    });

    await muxer.start();

    for (const chunk of encoded) {
        await muxer.addVideoFrame(chunk);
    }

    const blob = await muxer.finalize();

    console.log("MP4 blob:", blob);

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mediabunny-test.mp4";
    a.textContent = "Download MP4";
    document.body.appendChild(a);
}

document.getElementById("run").onclick = runTest;

