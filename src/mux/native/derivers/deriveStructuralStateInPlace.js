import { deriveDecodeTimestampsInPlace } from "./deriveDecodeTimestampsInPlace.js";
import { deriveChunkModel } from "./deriveChunkModel.js";
import { deriveStscEntries } from "./deriveStscEntries.js";
import { deriveTrackDuration } from "./deriveTrackDuration.js";
import { DecodeOrderStrategies} from "./strategies/decodeOrderStrategies.js";
import { ChunkingStrategies } from "./strategies/chunkingStrategies.js";
import { PacketizationStrategies } from "./strategies/packetizationStrategies.js"
import { deriveFfmpegOpusPacketRunsFromAccessUnits } from "./strategies/deriveFfmpegOpusPacketRunsFromAccessUnits.js";

const DEFAULT_CHUNKING_STRATEGY = ChunkingStrategies.ONE_SAMPLE_PER_CHUNK

const OPUS_FRAME_SIZE = 960;

export function deriveStructuralStateInPlace({ track }) {

    const accessUnits = track.semanticCore.accessUnits;

    deriveDecodeTimestampsInPlace({
        accessUnits,
        strategy: DecodeOrderStrategies.DECODE_ORDER_EQUALS_SAMPLE_ORDER
    });

    if (track.semanticTrackFamily === "audio") {

        const accessUnits = track.semanticCore.accessUnits;
        const codec = track.semanticCore.codec.codec;

        const hasPacketIndex =
            accessUnits.length > 0 &&
            accessUnits.every(au => Number.isInteger(au.packetIndex));

        // ---------------------------------------------------------
        // Packet topology applies ONLY to Opus
        // ---------------------------------------------------------
        if (codec === "opus" && !hasPacketIndex) {

            deriveCodecPacketRunsInPlace(track);

            resolvePacketTopology({
                accessUnits,
                semanticHints: track.semanticHints,
                codecName: codec
            });
        }

        // ---------------------------------------------------------
        // Postcondition (Opus only)
        // ---------------------------------------------------------
        if (codec === "opus" && !Number.isInteger(accessUnits[0]?.packetIndex)) {
            throw new Error(
                "deriveStructuralStateInPlace: packetIndex not materialised for opus audio track"
            );
        }
    }

    const chunkingStrategy = selectChunkingStrategy({
        track,
        buildHints: track.buildHints
    });

    // Default path (mp4a, WebCodecs, video)
    track.chunks = deriveChunkModel( accessUnits, chunkingStrategy);

    track.stscEntries = deriveStscEntries({ samples: accessUnits, chunks: track.chunks });

    track.trackDuration = deriveTrackDuration({ samples: accessUnits });

    // ---------------------------------------------------------
    // Opus: record packet-alignment remainder (FFmpeg behavior)
    // ---------------------------------------------------------
    if (track.semanticTrackFamily === "audio" && track.semanticCore.codec.codec === "opus") {

        const semanticHints = track.semanticHints ?? (track.semanticHints = {});

        semanticHints.encoderDelayRemainderSamples = track.trackDuration % OPUS_FRAME_SIZE;
    }
}


function deriveCodecPacketRunsInPlace(track) {

    const accessUnits = track.semanticCore.accessUnits;
    const semanticHints = track.semanticHints ?? (track.semanticHints = {});

    const packetizationStrategy =
        track.buildHints?.packetizationStrategy ??
        PacketizationStrategies.ONE_SAMPLE_PER_PACKET;

    switch (packetizationStrategy) {

        case PacketizationStrategies.FFMPEG_OPUS_PACKETIZATION:
            semanticHints.codecPacketRuns = deriveFfmpegOpusPacketRunsFromAccessUnits(accessUnits);
            return;

        case PacketizationStrategies.ONE_SAMPLE_PER_PACKET:
            semanticHints.codecPacketRuns = derivePacketRunsFromAccessUnits(accessUnits);
            return;

        default:
            throw new Error(
                `Unsupported packetizationStrategy '${packetizationStrategy}'`
            );
    }
}

function derivePacketRunsFromAccessUnits(accessUnits) {

    // Structural fallback (WebCodecs-compatible):
    // one access unit == one packent
    return accessUnits.map(() => ({
        samplesPerChunk: 1
    }));
}

/**
 * selectChunkingStrategy
 * ======================
 *
 * Chooses how media samples are grouped into chunks for this track.
 *
 * Chunking is a *container layout decision*. It does not change:
 * - what the media is
 * - how it is decoded
 * - when samples are played
 *
 * It only affects how samples are grouped inside the MP4 file.
 *
 * -------------------------------------------------------------
 * How the decision is made
 * -------------------------------------------------------------
 *
 * 1. Explicit override (highest priority)
 *
 *    If the caller supplies a chunkingStrategy in buildHints,
 *    that value is always used. This allows tests or special
 *    clients to control the file layout deliberately.
 *
 * 2. Default by track family
 *
 *    If no explicit strategy is supplied, the compiler selects
 *    a canonical default based on the semantic track family:
 *
 *      - video tracks  → ONE_SAMPLE_PER_CHUNK
 *      - audio tracks  → PACKETIZED
 *
 *    These defaults reflect empirically valid MP4 container
 *    layouts produced by modern encoders and are chosen to be:
 *      - valid for all players
 *      - deterministic
 *      - free of heuristic guesswork
 *
 * 3. Fallback
 *
 *    If the track type is unknown, ONE_SAMPLE_PER_CHUNK is used.
 *
 * -------------------------------------------------------------
 * Design notes
 * -------------------------------------------------------------
 *
 * - This function does not inspect sample data.
 * - It does not derive chunk topology or packet runs.
 * - It only selects the applicable chunking policy.
 * - All behaviour is explicit and reproducible.
 *
 * More advanced or adaptive chunking strategies can be added
 * later as named policies when a real requirement exists.
 */
function selectChunkingStrategy({ track, buildHints }) {

    if (buildHints?.chunkingStrategy) {
        return buildHints.chunkingStrategy;
    }

    if (track.semanticTrackFamily === "audio") {
        return ChunkingStrategies.PACKETIZED;
    }

    if (track.semanticTrackFamily === "video") {
        return ChunkingStrategies.ONE_SAMPLE_PER_CHUNK;
    }

    return ChunkingStrategies.ONE_SAMPLE_PER_CHUNK;
}

function resolvePacketTopology({ accessUnits, semanticHints, codecName, }) {

    // ---------------------------------------------------------
    // Case 1: packetIndex already supplied — trust verbatim
    // ---------------------------------------------------------
    const allPacketIndexPresent = accessUnits.every(accessUnit => Number.isInteger(accessUnit.packetIndex));
    if (allPacketIndexPresent) {
        console.log(`resolvePacketTopology for ${codecName}: all packet indexes are present`); return;
    }

    // ---------------------------------------------------------
    // Case 2: packet topology supplied via semanticHints
    // ---------------------------------------------------------
    const codecPacketRuns = semanticHints?.codecPacketRuns;

    if (Array.isArray(codecPacketRuns)) {
        console.log(`resolvePacketTopology for ${codecName}: all codecPacketRuns are present from semanticHints`);
        expandPacketRunsIntoPacketIndex({
            accessUnits,
            codecPacketRuns,
            codecName
        });
        return;
    }

    // ---------------------------------------------------------
    // Illegal state
    // ---------------------------------------------------------
    throw new Error(
        "PACKETIZED chunking selected, but packet topology is missing.\n" +
        "Provide either accessUnit.packetIndex, or semanticHints.codecPacketRuns\n" +
        "derived from the oracle stsc box."
    );
}

function expandPacketRunsIntoPacketIndex({ accessUnits, codecPacketRuns, codecName, }) {

    let sampleCursor = 0;
    let currentPacketIndex = 0;

    for (const run of codecPacketRuns) {

        const samplesInPacket = run.samplesPerChunk;

        for (let i = 0; i < samplesInPacket; i++) {

            if (sampleCursor >= accessUnits.length) {
                throw new Error(
                    `PACKETIZED chunking expandPacketRunsIntoPacketIndex for ${codecName}: codecPacketRuns exceed accessUnit count`
                );
            }

            accessUnits[sampleCursor].packetIndex = currentPacketIndex;
            sampleCursor++;
        }

        currentPacketIndex++;
    }

    if (sampleCursor !== accessUnits.length) {
        console.log(`expandPacketRunsIntoPacketIndex: track with codec(${codecName})`, accessUnits);
        console.log(`codecPacketRuns track with codec ${codecName}`, codecPacketRuns);
        throw new Error(
            `PACKETIZED chunking expandPacketRunsIntoPacketIndex for ${codecName}: codecPacketRuns do not cover all accessUnits`
        );
    }
    else {
        console.log(`PACKETIZED chunking expandPacketRunsIntoPacketIndex for ${codecName}: codecPacketRuns do cover all accessUnits`)
    }
}
