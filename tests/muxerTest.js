
import { Mp4BoxMuxer } from "../src/mux/Mp4BoxMuxer.js";

export async function runMuxerTest() {
    console.log("=== Real Encoder → Mp4BoxMuxer Test ===");

    // ----------------------------------------------------
    // 1. Encode three real WebCodecs frames
    // ----------------------------------------------------
    console.log("Configuring encoder…");

    const encoder = new VideoEncoder({
        output(chunk) {
            console.log("Encoder produced chunk:", {
                timestamp: chunk.timestamp,
                type: chunk.type,
                byteLength: chunk.byteLength
            });
            encodedChunks.push(chunk);
        },
        error(e) {
            console.error("Encoder error:", e);
        }
    });

    encoder.configure({
        codec: "avc1.42E01E",
        width: 320,
        height: 240,
        bitrate: 500000,
        framerate: 30
    });

    const encodedChunks = [];

    console.log("Encoding 3 frames…");
    for (let i = 0; i < 3; i++) {
        const canvas = new OffscreenCanvas(320, 240);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = i === 0 ? "red" : i === 1 ? "green" : "blue";
        ctx.fillRect(0, 0, 320, 240);

        const frame = new VideoFrame(canvas, { timestamp: i * 33333 });
        encoder.encode(frame);
        frame.close();
    }

    await encoder.flush();
    console.log("Encoder flush complete.");
    console.log("Total encoded chunks:", encodedChunks.length);

    // ----------------------------------------------------
    // 2. Construct muxer with correct track definition
    // ----------------------------------------------------
    console.log("Creating Mp4BoxMuxer…");

    const muxer = new Mp4BoxMuxer({
        tracks: [
            {
                id: 1,
                kind: "video",
                codec: "avc1",
                width: 320,
                height: 240,
                avcC: encoder.state?.config?.description || null
            }
        ]
    });

    // ----------------------------------------------------
    // 3. Start segmentation BEFORE samples
    // ----------------------------------------------------
    console.log("Calling muxer.start()…");
    muxer.start();

    // ----------------------------------------------------
    // 4. Feed samples into muxer
    // ----------------------------------------------------
    console.log("Adding samples…");

    for (const sample of encodedChunks) {
        console.log("Feeding encoded sample:", {
            timestamp: sample.timestamp,
            duration: sample.duration,
            byteLength: sample.byteLength,
            type: sample.type
        });
        sample.duration = 33333;
        muxer.addSample(1, sample);  // track 1 = video
    }

    // ----------------------------------------------------
    // 5. Finalize MP4
    // ----------------------------------------------------
    console.log("Calling finalize()…");
    const blob = await muxer.finalize();

    console.log("=== Final blob result ===");
    console.log("Blob =", blob);
    console.log("Blob.size =", blob.size);
    console.log("Blob.type =", blob.type);

    // ----------------------------------------------------
    // 6. Offer download link
    // ----------------------------------------------------
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "test-output.mp4";
    a.textContent = "Download MP4";
    document.body.appendChild(a);

    console.log("=== Test complete: download link added ===");
}
