/**
 * WebCodecs → Mp4BuildInput producers
 *
 * This module is the SINGLE source of truth for mapping
 * WebCodecs encoder output into Mp4BuildInput tracks.
 *
 * Review this modules location. It's in src/mux/native,
 * I'm not sure it should live here. Need to review, it's
 * basically a webcodecs adapter, but also not something
 * I want the app to care about, while also it increases my
 * compiler's API
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

    const descriptionBytes =
        decoderConfig.description instanceof Uint8Array
            ? new Uint8Array(decoderConfig.description)
            : decoderConfig.description instanceof ArrayBuffer
                ? new Uint8Array(decoderConfig.description)
                : null;

    if (!(descriptionBytes instanceof Uint8Array) || descriptionBytes.length === 0) {
        throw new Error("buildVideoTrackFromWebCodecs: decoderConfig.description is required");
    }

    return {
        semanticCore: {
            accessUnits,
            codec: {
                codec: decoderConfig.codec,
                config: {
                    representation: "container",
                    completeness: "semantic",
                    bytes: descriptionBytes
                }
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

    function toBytes(value) {
        if (value instanceof Uint8Array) return new Uint8Array(value);
        if (value instanceof ArrayBuffer) return new Uint8Array(value);
        return null;
    }

    const codecString = typeof decoderConfig?.codec === "string"
        ? decoderConfig.codec.toLowerCase()
        : "";

    const esdsBytes = toBytes(decoderConfig?.esds);
    const dOpsBytes = toBytes(decoderConfig?.dOps);
    const descriptionBytes = toBytes(decoderConfig?.description);

    let representation = "container";
    let configBytes = esdsBytes ?? dOpsBytes ?? descriptionBytes;

    if (!configBytes || configBytes.length === 0) {
        throw new Error("buildAudioTrackFromWebCodecs: missing decoder config bytes");
    }

    if (codecString.startsWith("mp4a")) {
        if (esdsBytes && esdsBytes.length > 0) {
            representation = "container";
            configBytes = esdsBytes;
        } else {
            representation = "elementary";
            configBytes = descriptionBytes;
        }
    } else if (codecString.startsWith("opus")) {
        representation = "container";
        configBytes = dOpsBytes ?? descriptionBytes;
    }

    return {
        semanticCore: {
            accessUnits,
            codec: {
                codec: decoderConfig.codec,
                config: {
                    representation,
                    bytes: configBytes
                }
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
