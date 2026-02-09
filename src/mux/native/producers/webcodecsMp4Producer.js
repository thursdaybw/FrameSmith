/**
 * WebCodecs → Mp4BuildInput producers
 *
 * This module is the SINGLE source of truth for mapping
 * WebCodecs encoder output into Mp4BuildInput tracks.
 *
 * Do not duplicate. Do not wrap. Do not reinterpret.
 */

export function buildVideoTrackFromWebCodecs({
    webcodecsOutput,
    buildParameters,
    semanticHints,
    buildHints
}) {
    const { encodedChunks, decoderConfig } = webcodecsOutput;

    const accessUnits = [];
    const accessUnitPayloads = [];

    for (const chunk of encodedChunks) {
        const bytes = new Uint8Array(chunk.byteLength);
        chunk.copyTo(bytes);

        accessUnitPayloads.push(bytes);
        accessUnits.push({
            pts: chunk.timestamp,
            isKey: chunk.type === "key"
        });
    }

    return {
        semanticCore: {
            accessUnits,
            codec: {
                codec: decoderConfig.codec,
                avcC: new Uint8Array(decoderConfig.description),
                avcCCompleteness: "semantic"
            }
        },

        payloads: {
            accessUnitPayloads
        },

        semanticHints,
        buildParameters,
        buildHints
    };
}

export function buildAudioTrackFromWebCodecs({
    webcodecsOutput,
    buildParameters
}) {
    const { encodedChunks, decoderConfig } = webcodecsOutput;

    const accessUnits = [];
    const accessUnitPayloads = [];

    for (const chunk of encodedChunks) {
        const bytes = new Uint8Array(chunk.byteLength);
        chunk.copyTo(bytes);

        accessUnitPayloads.push(bytes);
        accessUnits.push({
            pts: chunk.timestamp,
            isKey: true
        });
    }

    const dOps = new Uint8Array(decoderConfig.description);

    return {
        semanticCore: {
            accessUnits,
            codec: {
                codec: decoderConfig.codec,
                dOps
            }
        },

        payloads: {
            accessUnitPayloads
        },

        semanticHints: {},

        buildParameters,

        buildHints: {

            // WebCodecs does not expose packet topology.
            //
            // By default, the compiler preserves packet semantics
            // using identity packetization:
            //
            //   1 access unit == 1 packet
            //
            // This produces a semantically faithful MP4 that:
            //   - Matches encoder intent
            //   - Supports deterministic packetIndex derivation
            //   - Is future-proof for remuxing, trimming, and structural diffing
            //   - Remains fully playable in all decoders
            //
            // Opting OUT of packetization is OPTIONAL.
            // When enabled, the compiler uses ONE_SAMPLE_PER_CHUNK instead.
            //
            // Why opt out?
            //   - Slightly smaller file size
            //   - Simpler container structure
            //
            // Trade-off:
            //   - Packet semantics are flattened
            //   - Less structural information survives export
            //
            // Recommendation:
            //   - Omit this hint for highest semantic fidelity (default)
            //   - Enable non-packetized layout only when size matters
            //
            chunkingStrategy: "non-packetized"
        }
    };
}
