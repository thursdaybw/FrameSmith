import { NativeMuxer } from "../../NativeMuxer.js";
import { extractBoxByPath } from "../reference/BoxExtractor.js";
import { readUint32FromMp4BoxBytes } from "../testUtils.js";

export async function test_NativeMuxer_chunkPolicy_ffmpeg() {

    console.log("=== test_NativeMuxer_chunkPolicy_ffmpeg ===");

    const muxer = new NativeMuxer({
        codec: "avc1.42E01E",
        width: 320,
        height: 240,
        fps: 30,
        chunkPolicy: "ffmpeg-compatible"
    });

    // Fake minimal samples (no real encoding needed)
    for (let i = 0; i < 50; i++) {
        muxer.collector.addSample({
            data: new Uint8Array([0x00]),
            size: 1,
            timestampMicroseconds: i * 33333,
            durationMicroseconds: 33333
        });
    }

    // Fake timing finalize (bypass WebCodecs path)
    muxer.timing.addFrame(0);
    muxer.avcC.loadConfigurationRecord(new Uint8Array([1,2,3,4]));

    const blob = await muxer.finalize();
    const bytes = new Uint8Array(await blob.arrayBuffer());

    const stsc = extractBox(
        bytes,
        ["moov", "trak", "mdia", "minf", "stbl", "stsc"]
    );

    const samplesPerChunk = readUint32FromMp4BoxBytes(stsc, 20);

    if (samplesPerChunk !== 25) {
        throw new Error(
            `FAIL: expected samples_per_chunk = 25, got ${samplesPerChunk}`
        );
    }

    console.log("PASS: NativeMuxer respects ffmpeg-compatible chunk policy");
}
