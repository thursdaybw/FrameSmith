import { deriveChunkModel } from "../derivers/deriveChunkModel.js";
import { assertEqual } from "./assertions.js";
import { ChunkingStrategies } from "../derivers/strategies/chunkingStrategies.js"

export function testDeriveChunkModel_OneSamplePerChunk() {

    const s1 = { duration: 5 };
    const s2 = { duration: 7 };

    const samples = [s1, s2];

    const chunks = deriveChunkModel(
        samples,
        ChunkingStrategies.ONE_SAMPLE_PER_CHUNK
    );

    // ---------------------------------------------------------
    // chunk count
    // ---------------------------------------------------------
    assertEqual("chunk.count", chunks.length, 2);

    // ---------------------------------------------------------
    // one sample per chunk
    // ---------------------------------------------------------
    assertEqual("chunk[0].sampleCount", chunks[0].samples.length, 1);
    assertEqual("chunk[1].sampleCount", chunks[1].samples.length, 1);

    // ---------------------------------------------------------
    // semantic preservation
    // ---------------------------------------------------------
    assertEqual(
        "chunk[0].sample.sampleIndex",
        chunks[0].samples[0].sampleIndex,
        0
    );

    assertEqual(
        "chunk[1].sample.sampleIndex",
        chunks[1].samples[0].sampleIndex,
        1
    );

    assertEqual(
        "chunk[0].sample.duration",
        chunks[0].samples[0].sample.duration,
        5
    );

    assertEqual(
        "chunk[1].sample.duration",
        chunks[1].samples[0].sample.duration,
        7
    );

    // ---------------------------------------------------------
    // aggregate duration
    // ---------------------------------------------------------
    assertEqual("chunk[0].duration", chunks[0].duration, 5);
    assertEqual("chunk[1].duration", chunks[1].duration, 7);

}
