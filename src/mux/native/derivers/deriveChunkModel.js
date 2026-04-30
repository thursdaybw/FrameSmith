import { ChunkingStrategies } from "./strategies/chunkingStrategies.js";
import { getSamplesChunkedInFfmpegOpusFormat } from "./strategies/getSamplesChunkedInFfmpegOpusFormat.js";

/**
 * Derive an abstract chunk model from semantic samples.
 *
 * PASS 1 — SEMANTIC GROUPING
 *
 * Responsibilities:
 *   - group samples according to policy
 *   - preserve sample ordering
 *   - assign stable sample identity
 *
 * Non-responsibilities:
 *   - no bytes
 *   - no offsets
 *   - no MP4 structure
 *
 * Output:
 *   [
 *     {
 *       samples: [{ sampleIndex, ...semanticSample }],
 *       duration
 *     }
 *   ]
 */
export function deriveChunkModel(samples, policy) {

    if (!Array.isArray(samples)) {
        throw new Error("deriveChunkModel: samples must be an array");
    }

    let chunks;

    switch (policy) {

        case ChunkingStrategies.ONE_SAMPLE_PER_CHUNK: {
            chunks = samples.map((sample, index) => ({
                samples: [{
                    sample,
                    sampleIndex: index
                }],
                duration: sample.duration
            }));
            break;
        }

        case ChunkingStrategies.ALL_SAMPLES_ONE_CHUNK: {
            chunks = [{
                samples: samples.map((sample, index) => ({
                    sample,
                    sampleIndex: index
                })),
                duration: samples.reduce((n, s) => n + s.duration, 0)
            }];
            break;
        }

        case ChunkingStrategies.PACKETIZED: {

            chunks = chunkSamplesByPacketIndex({ samples });
            break;
        }

        case ChunkingStrategies.FFMPEG_OPUS_PACKET_GROUPED: {
           chunks = getSamplesChunkedInFfmpegOpusFormat({ samples }); 
           break;
        }

        default:
            throw new Error(
                `deriveChunkModel: unsupported policy '${policy}'`
            );
    }

    validateChunkModel({ chunks, samples });

    return chunks;

}

function validateChunkModel({ chunks, samples }) {

    if (!Array.isArray(chunks)) {
        throw new Error("validateChunkModel: chunks must be an array");
    }

    if (!Array.isArray(samples)) {
        throw new Error("validateChunkModel: samples must be an array");
    }

    const seenSampleIndices = new Set();

    let lastSampleIndex = -1;

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {

        const chunk = chunks[chunkIndex];

        if (!chunk || !Array.isArray(chunk.samples)) {
            throw new Error(
                "validateChunkModel: chunk.samples must be an array\n" +
                `chunkIndex=${chunkIndex}`
            );
        }

        for (let i = 0; i < chunk.samples.length; i++) {

            const entry = chunk.samples[i];

            if (!entry || typeof entry !== "object") {
                throw new Error(
                    "validateChunkModel: chunk.samples entry must be an object\n" +
                    `chunkIndex=${chunkIndex}, entryIndex=${i}`
                );
            }

            if (!Number.isInteger(entry.sampleIndex)) {
                throw new Error(
                    "validateChunkModel: sampleIndex must be an integer\n" +
                    `chunkIndex=${chunkIndex}, entryIndex=${i}, value=${entry.sampleIndex}`
                );
            }

            const sampleIndex = entry.sampleIndex;

            if (sampleIndex < 0 || sampleIndex >= samples.length) {
                throw new Error(
                    "validateChunkModel: sampleIndex out of bounds\n" +
                    `chunkIndex=${chunkIndex}, entryIndex=${i}, sampleIndex=${sampleIndex}, sampleCount=${samples.length}`
                );
            }

            if (seenSampleIndices.has(sampleIndex)) {
                throw new Error(
                    "validateChunkModel: duplicate sampleIndex detected\n" +
                    `chunkIndex=${chunkIndex}, entryIndex=${i}, sampleIndex=${sampleIndex}`
                );
            }

            // Enforce global ordering
            if (sampleIndex <= lastSampleIndex) {
                throw new Error(
                    "validateChunkModel: sampleIndex order violation\n" +
                    `chunkIndex=${chunkIndex}, entryIndex=${i}, sampleIndex=${sampleIndex}, lastSampleIndex=${lastSampleIndex}`
                );
            }

            seenSampleIndices.add(sampleIndex);
            lastSampleIndex = sampleIndex;
        }
    }

    // Ensure full coverage
    if (seenSampleIndices.size !== samples.length) {

        const missing = [];

        for (let i = 0; i < samples.length; i++) {
            if (!seenSampleIndices.has(i)) {
                missing.push(i);
            }
        }

        throw new Error(
            "validateChunkModel: chunk model does not cover all samples\n" +
            `covered=${seenSampleIndices.size}, expected=${samples.length}\n` +
            `missingSampleIndices=${missing.slice(0, 20).join(", ")}`
        );
    }
}

function chunkSamplesByPacketIndex({ samples }) {

    if (!Array.isArray(samples)) {
        throw new Error("chunkSamplesByPacketIndex: samples must be an array");
    }

    if (!samples.every(s => Number.isInteger(s.packetIndex))) {
        throw new Error(
            "chunkSamplesByPacketIndex: all samples must have packetIndex"
        );
    }

    const chunks = [];

    let currentPacketIndex = samples[0].packetIndex;
    let currentChunkSamples = [];

    let sampleCursor = 0;

    for (let i = 0; i < samples.length; i++) {

        const sample = samples[i];

        if (sample.packetIndex !== currentPacketIndex) {

            chunks.push({
                samples: currentChunkSamples.map(s => ({
                    sample: s,
                    sampleIndex: sampleCursor++
                }))
            });

            currentPacketIndex = sample.packetIndex;
            currentChunkSamples = [];
        }

        currentChunkSamples.push(sample);
    }

    // flush final chunk
    chunks.push({
        samples: currentChunkSamples.map(s => ({
            sample: s,
            sampleIndex: sampleCursor++
        }))
    });

    return chunks;
}
