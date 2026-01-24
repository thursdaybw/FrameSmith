import { ChunkingStrategies } from "../derivers/strategies/chunkingStrategies.js";

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


    switch (policy) {

        case ChunkingStrategies.ONE_SAMPLE_PER_CHUNK:
            return samples.map((sample, index) => ({
                samples: [{
                    sample,
                    sampleIndex: index
                }],
                duration: sample.duration
            }));

        case ChunkingStrategies.ALL_SAMPLES_ONE_CHUNK:
            return [{
                samples: samples.map((sample, index) => ({
                    sample,
                    sampleIndex: index
                })),
                duration: samples.reduce((n, s) => n + s.duration, 0)
            }];

        case ChunkingStrategies.PACKETIZED: {
            const chunks = [];
            let currentPacket = null;

            for (let i = 0; i < samples.length; i++) {
                const sample = samples[i];

                if (
                    !currentPacket ||
                    sample.packetIndex !== currentPacket.packetIndex
                ) {
                    currentPacket = {
                        packetIndex: sample.packetIndex,
                        samples: [],
                        duration: 0
                    };
                    chunks.push(currentPacket);
                }

                currentPacket.samples.push({
                    sample,
                    sampleIndex: i
                });

                currentPacket.duration += sample.duration;
            }

            return chunks;
        }

        default:
            throw new Error(
                `deriveChunkModel: unsupported policy '${policy}'`
            );
    }
}
