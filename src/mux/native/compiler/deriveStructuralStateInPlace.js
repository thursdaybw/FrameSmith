import { deriveDecodeTimestampsInPlace } from "../derivers/deriveDecodeTimestampsInPlace.js";
import { deriveChunkModel } from "../derivers/deriveChunkModel.js";
import { deriveStscEntries } from "../derivers/deriveStscEntries.js";
import { deriveTrackDuration } from "../derivers/deriveTrackDuration.js";
import { DecodeOrderStrategies} from "../derivers/strategies/decodeOrderStrategies.js";
import { ChunkingStrategies } from "../derivers/strategies/chunkingStrategies.js";

export function deriveStructuralStateInPlace(mp4CompilerState) {

    for (const track of mp4CompilerState.tracks) {


        const accessUnits = track.semanticCore.accessUnits;

        deriveDecodeTimestampsInPlace({
            accessUnits,
            strategy: DecodeOrderStrategies.DECODE_ORDER_EQUALS_SAMPLE_ORDER
        });

        const chunkingStrategy = selectChunkingStrategy({
            track,
            buildHints: track.buildHints
        });

        // ---------------------------------------------------------
        // Resolve packet topology if PACKETIZED is selected
        // ---------------------------------------------------------
        if (chunkingStrategy === ChunkingStrategies.PACKETIZED) {
            if (chunkingStrategy === ChunkingStrategies.PACKETIZED) {
                resolvePacketTopology({
                    accessUnits: track.semanticCore.accessUnits,
                    semanticHints: track.semanticHints
                });
            }
        }

        track.chunks = deriveChunkModel(
            accessUnits,
            chunkingStrategy
        );

        track.stscEntries = deriveStscEntries({
            samples: accessUnits,
            chunks: track.chunks
        });

        track.trackDuration = deriveTrackDuration({
            samples: accessUnits
        });
    }
}

function selectChunkingStrategy({ track, buildHints }) {

    if (buildHints?.chunkingStrategy) {
        return buildHints.chunkingStrategy;
    }

    if (track.semanticTrackFamily === "audio") {
        return ChunkingStrategies.FIXED_SAMPLES_PER_CHUNK;
    }

    if (track.semanticTrackFamily === "video") {

        if (track.semanticCore.accessUnits.length < SMALL_N) {
            return ChunkingStrategies.ONE_SAMPLE_PER_CHUNK;
        }

        if (track.hasNonZeroCompositionOffset) {
            return ChunkingStrategies.GOP_ALIGNED;
        }

        return ChunkingStrategies.FIXED_DURATION_CHUNKS;
    }

    return ChunkingStrategies.ONE_SAMPLE_PER_CHUNK;
}

function resolvePacketTopology({
    accessUnits,
    semanticHints
}) {

    // ---------------------------------------------------------
    // Case 1: packetIndex already supplied — trust verbatim
    // ---------------------------------------------------------
    const allPacketIndexPresent =
        accessUnits.every(accessUnit =>
            Number.isInteger(accessUnit.packetIndex)
        );

    if (allPacketIndexPresent) {
        return;
    }

    // ---------------------------------------------------------
    // Case 2: packet topology supplied via semanticHints
    // ---------------------------------------------------------
    const packetRuns = semanticHints?.packetRuns;

    if (Array.isArray(packetRuns)) {
        expandPacketRunsIntoPacketIndex({
            accessUnits,
            packetRuns
        });
        return;
    }

    // ---------------------------------------------------------
    // Illegal state
    // ---------------------------------------------------------
    throw new Error(
        "PACKETIZED chunking selected, but packet topology is missing.\n" +
        "Provide either accessUnit.packetIndex, or semanticHints.packetRuns\n" +
        "derived from the oracle stsc box."
    );
}

function expandPacketRunsIntoPacketIndex({
    accessUnits,
    packetRuns
}) {

    let sampleCursor = 0;
    let currentPacketIndex = 0;

    for (const run of packetRuns) {

        const samplesInPacket = run.samplesPerChunk;

        for (let i = 0; i < samplesInPacket; i++) {

            if (sampleCursor >= accessUnits.length) {
                throw new Error(
                    "PACKETIZED chunking: packetRuns exceed accessUnit count"
                );
            }

            accessUnits[sampleCursor].packetIndex = currentPacketIndex;
            sampleCursor++;
        }

        currentPacketIndex++;
    }

    if (sampleCursor !== accessUnits.length) {
        throw new Error(
            "PACKETIZED chunking: packetRuns do not cover all accessUnits"
        );
    }
}
