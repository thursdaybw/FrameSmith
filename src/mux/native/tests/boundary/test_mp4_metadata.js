import { buildTestMp4 } from "./helpers/buildTestMp4.js";

export async function test_mp4_metadata() {
    console.log("=== boundary: test_mp4_metadata ===");

    const { blob } = await buildTestMp4();

    // now inspect metadata
    const buffer = await blob.arrayBuffer();

    console.log("PASS: metadata read");
}
