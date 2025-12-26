import { deriveChunkModel } from "../deriveChunkModel.js";
import { assertEqual } from "./assertions.js";
import { ChunkPolicies } from "../policies/chunkPolicies.js";

export function testDeriveChunkModel_OneSamplePerChunk() {

    console.log("=== testDeriveChunkModel_OneSamplePerChunk ===");

    const s1 = { bytes: new Uint8Array(10), duration: 5 };
    const s2 = { bytes: new Uint8Array(20), duration: 7 };

    const samples = [s1, s2];

    const chunks = deriveChunkModel(
        samples,
        ChunkPolicies.ONE_SAMPLE_PER_CHUNK
    );

    // chunk count
    assertEqual("chunk.count", chunks.length, 2);

    // one sample per chunk
    assertEqual("chunk[0].sampleCount", chunks[0].samples.length, 1);
    assertEqual("chunk[1].sampleCount", chunks[1].samples.length, 1);

    // identity preservation
    assertEqual("chunk[0].sample.identity", chunks[0].samples[0], s1);
    assertEqual("chunk[1].sample.identity", chunks[1].samples[0], s2);

    // aggregates
    assertEqual("chunk[0].byteLength", chunks[0].byteLength, 10);
    assertEqual("chunk[1].duration", chunks[1].duration, 7);

    console.log("PASS: deriveChunkModel preserves samples correctly");
}
