import { planChunkLayout } from "../chunkLayoutPolicy.js";

export function testChunkLayout_FramesmithSimple() {
    console.log("=== testChunkLayout_FramesmithSimple ===");

    const samples = new Array(100).fill({}); // shape irrelevant

    const layout = planChunkLayout({
        policy: "framesmith-simple",
        samples
    });

    if (layout.firstChunk !== 1) {
        throw new Error("FAIL: firstChunk must be 1");
    }

    if (layout.samplesPerChunk !== 1) {
        throw new Error("FAIL: framesmith-simple must use 1 sample per chunk");
    }

    if (layout.sampleDescriptionIndex !== 1) {
        throw new Error("FAIL: sampleDescriptionIndex must be 1");
    }

    console.log("PASS: framesmith-simple chunk layout");
}

export function testChunkLayout_FfmpegCompatible() {
    console.log("=== testChunkLayout_FfmpegCompatible ===");

    const samples = new Array(100).fill({});

    const layout = planChunkLayout({
        policy: "ffmpeg-compatible",
        samples
    });

    if (layout.samplesPerChunk !== 25) {
        throw new Error(
            `FAIL: ffmpeg-compatible expected 25 samples per chunk, got ${layout.samplesPerChunk}`
        );
    }

    console.log("PASS: ffmpeg-compatible chunk layout");
}
