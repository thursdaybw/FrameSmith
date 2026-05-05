import { createMp4FromInputs } from "../../vendor/native-mp4-muxer/index.js";

document.getElementById("run").onclick = async () => {
    console.log("=== NativeMuxer Smoke Test ===", { createMp4FromInputs });

    // TODO:
    // 1. generate 3 synthetic frames
    // 2. encode using WebCodecs
    // 3. feed to NativeMuxer
    // 4. download MP4

    console.log("Not implemented yet (scaffolding only)");
};
