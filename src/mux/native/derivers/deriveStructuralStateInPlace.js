import { deriveDecodeTimestampsInPlace } from "./deriveDecodeTimestampsInPlace.js";
import { deriveChunkModel } from "./deriveChunkModel.js";
import { deriveStscEntries } from "./deriveStscEntries.js";
import { deriveTrackDuration } from "./deriveTrackDuration.js";
import { DecodeOrderStrategies} from "./strategies/decodeOrderStrategies.js";
import { ChunkingStrategies } from "./strategies/chunkingStrategies.js";
import { PacketizationStrategies } from "./strategies/packetizationStrategies.js"
import { deriveFfmpegOpusPacketRunsFromAccessUnits } from "./strategies/deriveFfmpegOpusPacketRunsFromAccessUnits.js";
import { validatePacketTopologyAdmissibility } from "../compiler/validateCompilerAdmissibility.js";

const DEFAULT_CHUNKING_STRATEGY = ChunkingStrategies.ONE_SAMPLE_PER_CHUNK

const OPUS_FRAME_SIZE = 960;

/**
 * deriveStructuralStateInPlace
 * ============================
 *
 * Derives the *structural* representation of a track in-place from its
 * normalized semantic inputs.
 *
 * Structural derivation answers container-level questions such as:
 *   - how samples are grouped into chunks
 *   - how chunks map to samples (stsc)
 *   - how long the track is
 *
 * It does NOT:
 *   - change media semantics
 *   - infer codec behaviour heuristically
 *   - inspect payload bytes
 *
 * All inputs are assumed to be semantically normalized before entry.
 *
 * ------------------------------------------------------------------
 * Track-family invariants
 * ------------------------------------------------------------------
 *
 * This function currently handles multiple semantic track families
 * (audio and video) in a single control flow. These families have
 * *different and non-overlapping invariants*:
 *
 * Audio tracks:
 *   - Have packet semantics
 *   - MUST have packetIndex materialised on all access units
 *   - Default to PACKETIZED chunking
 *   - May derive identity packetization when topology is not supplied
 *   - Chunking policy affects grouping, not packet existence
 *
 * Video tracks:
 *   - Do NOT have packet semantics
 *   - MUST NOT have packetIndex on access units
 *   - Always use ONE_SAMPLE_PER_CHUNK
 *   - Chunking is a simple container layout decision
 *
 * These invariants are enforced explicitly to prevent illegal
 * cross-contamination (e.g. packetized video or packetless audio).
 *
 * ------------------------------------------------------------------
 * Ordering guarantees
 * ------------------------------------------------------------------
 *
 * Structural derivation proceeds in this order:
 *
 *   1. Decode timestamp derivation (DTS)
 *   2. Track-family-specific normalization (e.g. audio packetIndex)
 *   3. Chunking strategy selection
 *   4. Structural validation of requested layout
 *   5. Chunk model derivation
 *   6. STSC derivation
 *   7. Track duration derivation
 *
 * Packet semantics (when applicable) are fully materialised BEFORE
 * chunk derivation. Chunking must never invent or guess packet topology.
 *
 * ------------------------------------------------------------------
 * Design note / future refactor
 * ------------------------------------------------------------------
 *
 * This function is intentionally conservative and explicit, but it
 * currently interleaves audio and video logic via conditionals.
 *
 * As additional track families are added, this function should be
 * refactored into per-track-family derivation paths, e.g.:
 *
 *   - deriveAudioStructuralStateInPlace
 *   - deriveVideoStructuralStateInPlace
 *
 * with this function acting as a thin dispatcher based on
 * semanticTrackFamily.
 *
 * That refactor would:
 *   - make invariants local and self-evident
 *   - eliminate illegal states by construction
 *   - simplify reasoning and future extension
 *
 * Until then, all invariants are enforced explicitly and covered
 * by tests.
 */
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

    // ---------------------------------------------------------
    // Identity packetization (default, derivable)
    // ---------------------------------------------------------

    // ---------------------------------------------------------
    // INVARIANT
    // ---------------------------------------------------------
    // Any track that reaches PACKETIZED chunking MUST have
    // packetIndex materialised on every access unit.
    //
    // WebCodecs and mp4a do not expose packet topology.
    // In those cases, identity packetization is applied:
    //
    //   1 access unit == 1 packet
    //
    // This MUST happen before:
    //   - packet topology validation
    //   - deriveChunkModel()
    // ---------------------------------------------------------
    // ---------------------------------------------------------
    // Identity packetization (audio only, default, derivable)
    // ---------------------------------------------------------
    if (
        track.semanticTrackFamily === "audio" &&
        selectChunkingStrategy({ track, buildHints: track.buildHints }) === ChunkingStrategies.PACKETIZED
    ) {

        const accessUnits = track.semanticCore.accessUnits;

        const hasPacketIndex =
            Array.isArray(accessUnits) &&
            accessUnits.length > 0 &&
            accessUnits.every(au => Number.isInteger(au.packetIndex));

        if (!hasPacketIndex) {
            // Identity packetization: 1 sample == 1 packet
            for (let i = 0; i < accessUnits.length; i++) {
                accessUnits[i].packetIndex = i;
            }
        }
    }


    if (chunkingStrategy === ChunkingStrategies.PACKETIZED) {
        validatePacketTopologyAdmissibility(track, track.trackId ?? 0);
    }

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

    // ---------------------------------------------------------
    // 1. Explicit opt-out
    // ---------------------------------------------------------
    if (buildHints?.chunkingStrategy === "non-packetized") {
        return ChunkingStrategies.ONE_SAMPLE_PER_CHUNK;
    }

    // ---------------------------------------------------------
    // 2. Explicit non-identity packetization
    // ---------------------------------------------------------
    if (
        buildHints?.chunkingStrategy === "ffmpeg-opus-packet-grouped" ||
        buildHints?.packetizationStrategy === "explicit"
    ) {
        return ChunkingStrategies.PACKETIZED;
    }

    // ---------------------------------------------------------
    // 3. Default by track family
    // ---------------------------------------------------------
    if (track.semanticTrackFamily === "audio") {
        return ChunkingStrategies.PACKETIZED;
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
