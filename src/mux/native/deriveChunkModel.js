import { ChunkPolicies } from "./policies/chunkPolicies.js";

/**
 * Derive an abstract chunk model from semantic samples.
 *
 * This is Pass 1 of NativeMuxer assembly.
 *
 * Inputs:
 *   - samples: Sample[]
 *   - policy: chunk layout policy result
 *
 * Output:
 *   - ChunkModel
 *
 * No bytes.
 * No offsets.
 * No MP4 knowledge.
 */
export function deriveChunkModel(samples, policy) {

    if (!Array.isArray(samples)) {
        throw new Error("deriveChunkModel: samples must be an array");
    }

    if (!policy) {
        throw new Error("deriveChunkModel: policy is required");
    }

    console.log("deriveChunkModel policy =", policy);
    console.log("ALL =", ChunkPolicies.ALL_SAMPLES_ONE_CHUNK);

    switch (policy) {

        case ChunkPolicies.ONE_SAMPLE_PER_CHUNK:
            return samples.map(sample => ({
                samples: [sample],
                duration: sample.duration,
                byteLength: sample.bytes.length
            }));

        case ChunkPolicies.ALL_SAMPLES_ONE_CHUNK:
            return [{
                samples,
                duration: samples.reduce((n, s) => n + s.duration, 0),
                byteLength: samples.reduce((n, s) => n + s.bytes.length, 0)
            }];

        default:
            throw new Error(
                `deriveChunkModel: unsupported policy '${policy}'`
            );
    }
}
