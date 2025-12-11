import { NativeMuxer } from "../../../NativeMuxer.js";

export async function buildTestMp4() {
    const spspps = new Uint8Array([
        0,0,0,1, 103,66,192,11,140,104,66,73,168,8,8,8,60,34,17,168,
        0,0,0,1, 104,206,60,128
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

    return { blob, muxer };
}
