import { extractSemanticAccessUnitsFromMp4 } from "../../demux/container/extractSemanticAccessUnitsFromMp4.js";

import { extractAccessUnitPayloadsFromMp4 } from "../reference/extractAccessUnitPayloadsFromMp4.js";

import { extractTrackDurationFromOracleStts }
    from "../reference/extractTrackDurationFromOracleStts.js";


import {
    extractTrackCodecConfigurationFromMp4
} from "../../demux/container/extractTrackCodecConfigurationFromMp4.js";

import {
    extractTrackContainerMetadataFromMp4
} from "../../demux/container/extractTrackContainerMetadataFromMp4.js";

import {
    extractOpaqueUserDataFromMp4UsingRootContainer
} from "../reference/extractOpaqueUserDataFromMp4UsingRootContainer.js";

import {
    extractMovieTimingHintsFromMp4
} from "../reference/extractMovieTimingHintsFromMp4.js";

import { getGoldenTruthBox } from "../goldenTruthExtractors/index.js";

// -----------------------------------------------------------------------------
// Golden MP4 → Mp4BuildInput
// -----------------------------------------------------------------------------
export async function runGoldenMp4AVTestClient({ mp4Bytes }) {

    if (!(mp4Bytes instanceof Uint8Array)) {
        throw new Error("GoldenMp4AVTestClient: mp4Bytes must be Uint8Array");
    }

    const audioCodecConfiguration = extractTrackCodecConfigurationFromMp4({ mp4Bytes, zeroBasedTrackIndex: 1 });

    const videoTrack = extractVideoTrackFromMp4({ mp4Bytes });
    const audioTrack = extractAudioTrackFromMp4({ mp4Bytes });

    const buildHints = {};

    /*
     * todo: this is supported, just need a decisoin here. this
     * is a testinig policy desicion, pass in opaque udta (remux style)
     * or pass ion the semantics
    const udtaBytes = extractOpaqueUserDataFromMp4UsingRootContainer({
        mp4Bytes
    });

    if (udtaBytes instanceof Uint8Array) {
        buildHints.udtaBytes = udtaBytes;
    }
    */

    const udtaIntent = extractUdtaIntentFromMp4({ mp4Bytes });

    if (udtaIntent !== undefined) {
        buildHints.udta = udtaIntent;
    }

    const semanticHints = extractMovieTimingHintsFromMp4({ mp4Bytes });

    /* This is not good, out of context, there is no mp4CompilerState or tracks available directly.
     * and there is already an  extractMovieTimingHintsFromMp4.
    mp4CompilerState.semanticHints = mp4CompilerState.semanticHints ?? {};
    mp4CompilerState.semanticHints.movieDuration = mp4CompilerState.tracks[0]?.semanticHints?.inputTrackDurationInTrackTimescale;

    if (!Number.isInteger(mp4CompilerState.semanticHints.movieDuration)) {
        throw new Error(
            "runGoldenMp4AVTestClient: missing inputTrackDurationInTrackTimescale"
        );
    }
    */

    if ( audioTrack.semanticCore.codec.codec == "opus") {
        const trackDurationInTrackTimescale = extractTrackDurationFromOracleStts({ mp4Bytes, zeroBasedTrackIndex: 0 });

        videoTrack.semanticHints.inputTrackDurationInMovieTimescale =
            Math.round(
                trackDurationInTrackTimescale *
                semanticHints.movieTimescale /
                videoTrack.buildParameters.trackTimescale
            );
    }

    return {
        tracks: [
            videoTrack,
            audioTrack
        ],

        buildHints,
        semanticHints
    };
}


function extractUdtaIntentFromMp4({ mp4Bytes }) {
    try {
        return getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(mp4Bytes, "moov/udta")
            .getEmitterInput();
    } catch {
        return undefined;
    }
}
// -----------------------------------------------------------------------------
// Track extraction helpers
// -----------------------------------------------------------------------------

function extractVideoTrackFromMp4({ mp4Bytes, audioCodecName }) {

    const accessUnits = extractSemanticAccessUnitsFromMp4({ mp4Bytes, zeroBasedTrackIndex: 0 });
    const accessUnitPayloads = extractAccessUnitPayloadsFromMp4({ mp4Bytes, zeroBasedTrackIndex: 0 });

    if (!Array.isArray(accessUnits) || accessUnits.length === 0) {
        throw new Error("GoldenMp4AVTestClient: no video accessUnits extracted");
    }

    if (!Array.isArray(accessUnitPayloads)) {
        throw new Error("GoldenMp4AVTestClient: missing video payloads");
    }

    if (accessUnits.length !== accessUnitPayloads.length) {
        throw new Error("GoldenMp4AVTestClient: video sample/payload count mismatch");
    }


    const codecConfig = extractTrackCodecConfigurationFromMp4({ mp4Bytes, zeroBasedTrackIndex: 0 });

    const buildParameters = extractTrackContainerMetadataFromMp4({ mp4Bytes, zeroBasedTrackIndex: 0 });

    const buildHints = {};

    buildHints.compressorName = getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(mp4Bytes, "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]")
            .getEmitterInput().compressorName;

    const syncRepresentation = extractSyncRepresentationBuildHint({ mp4Bytes, zeroBasedTrackIndex: 0 });

    if (syncRepresentation !== undefined) {
        buildHints.syncRepresentation = syncRepresentation;
    }

    // Optional container compatibility hints (oracle passthrough)
    const pasp = extractPixelAspectRatioFromMp4UsingZeroBasedTrackIndex({ mp4Bytes, zeroBasedTrackIndex: 0 });

    if (pasp !== undefined) {
        buildHints.pasp = pasp;
    }

    const btrt = extractOptionalBtrtBuildHint({ mp4Bytes, zeroBasedTrackIndex: 0 });

    if (btrt !== undefined) {
        buildHints.btrt = btrt;
    }

    const semanticHints = {};

    semanticHints.edits = {
        elst: getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4Bytes,
            `moov/trak[0]/edts/elst`
        ).getEmitterInput()
    };

    // HARD-CODE oracle chunking for now
    //buildHints.chunkingStrategy = "one-sample-per-chunk";

    console.log("extractVideoTrack codecConfig", codecConfig);

    const codec = codecConfig;

    if (!(codec.config.bytes instanceof Uint8Array)) {
        console.log("BAD CODEC CONFIG", codec);
    }

    return {
        semanticCore: {
            accessUnits,
            codec
        },

        payloads: {
            accessUnitPayloads
        },

        buildParameters,

        buildHints,

        semanticHints,
    };
}

function extractAudioTrackFromMp4({ mp4Bytes }) {

    const codecConfig = extractTrackCodecConfigurationFromMp4({ mp4Bytes, zeroBasedTrackIndex: 1 });
    const accessUnits = extractSemanticAccessUnitsFromMp4({ mp4Bytes, zeroBasedTrackIndex: 1, });
    const accessUnitPayloads = extractAccessUnitPayloadsFromMp4({ mp4Bytes, zeroBasedTrackIndex: 1, });

    if (!Array.isArray(accessUnits) || accessUnits.length === 0 || accessUnits == undefined) {
        throw new Error("GoldenMp4AVTestClient: no audio accessUnits extracted");
    }

    if (accessUnits.length !== accessUnitPayloads.length || accessUnitPayloads == undefined) {
        throw new Error("GoldenMp4AVTestClient: audio sample/payload count mismatch");
    }

    const buildParameters = extractTrackContainerMetadataFromMp4({ mp4Bytes, zeroBasedTrackIndex: 1 });

    // Audio shape symmetry with WebCodecs
    if (codecConfig.channelCount !== undefined) {
        buildParameters.channelCount = codecConfig.channelCount;
    }

    if (codecConfig.sampleRate !== undefined) {
        buildParameters.sampleRate = codecConfig.sampleRate;
    }

    const semanticHints = {};

    semanticHints.inputTrackDurationInTrackTimescale = extractTrackDurationFromOracleStts({ mp4Bytes, zeroBasedTrackIndex: 1 });

    /**
     * You can override the hdlr nameBytes for a track
     * These are already the defults, so no need.
     *    semanticHints.hdlr = {
     *        name: "SoundHandler"
     *    };
     *    semanticHints.hdlr = {
     *        nameBytes: new Uint8Array([
     *            83, 111, 117, 110, 100, 72, 97, 110, 100, 108, 101, 114, 0
     *        ])
     *    };
     */
    const buildHints = {};

    const syncRepresentation = extractSyncRepresentationBuildHint({ mp4Bytes, zeroBasedTrackIndex: 1 });

    if (syncRepresentation !== undefined) {
        buildHints.syncRepresentation = syncRepresentation;
    }

    const btrt = extractOptionalBtrtBuildHint({ mp4Bytes, zeroBasedTrackIndex: 1 });

    if (btrt !== undefined) {
        buildHints.btrt = btrt;
    }

    semanticHints.edits = {
        elst: getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4Bytes,
            `moov/trak[1]/edts/elst`
        ).getEmitterInput()
    }

    const codec = {
        codec: codecConfig.codec,
        config: codecConfig.config
    };

    if (!(codec.config?.bytes instanceof Uint8Array)) {
        console.log("BAD CODEC CONFIG", { track: "audio", codecConfig });
    }

    if (codecConfig.codec == "opus") {

        buildHints.chunkingStrategy      = "ffmpeg-opus-packet-grouped";
        buildHints.packetizationStrategy = "ffmpeg-opus-packetization";

        semanticHints.authoritativeStszRepresentation = getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4Bytes,
                "moov/trak[1]/mdia/minf/stbl/stsz"
            )
            .getEmitterInput();

        semanticHints.encoderDelaySamples = deriveOpusEncoderDelaySamples({
            accessUnits,
            codecConfig: { dOps: codec.config.bytes }
        });

    }
    else if (codecConfig.codec == "mp4a") {
        semanticHints.codecPacketRuns = deriveExpandedChunkSampleCounts({ mp4Bytes, zeroBasedTrackIndex: 1 });
        semanticHints.encoderDelaySamples = extractAacEncoderDelaySamples(codec.config.bytes);
    }
    else {
        throw new Error(
            "extractAudioTrackFromMp4: Invalid codec" +
            `Recieved ${codecConfig}`
        );
    }

    return {
        semanticCore: {
            accessUnits,
            codec
        },

        payloads: {
            accessUnitPayloads
        },

        buildParameters,

        buildHints,

        semanticHints,
    };
}

function extractStssFromMp4UsingZeroBasedTrackIndex({
    mp4Bytes,
    zeroBasedTrackIndex
}) {

    const path =
        `moov/trak[${zeroBasedTrackIndex}]/mdia/minf/stbl/stss`;

    try {
        const box =
            getGoldenTruthBox
                .getSemanticBoxDataByPathFromMp4File(mp4Bytes, path)
                .readBoxReport()
                .box;

        return {
            sampleNumbers: box.fields.sampleNumbers
        };

    } catch {
        return undefined;
    }
}

function extractSampleGroupingFromMp4UsingZeroBasedTrackIndex({ mp4Bytes, zeroBasedTrackIndex }) {

    const basePath = `moov/trak[${zeroBasedTrackIndex}]/mdia/minf/stbl`;

    const sgpdIntent = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(mp4Bytes, `${basePath}/sgpd`).getEmitterInput()
    const sbgpIntent = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(mp4Bytes, `${basePath}/sbgp`).getEmitterInput()

    return {
        sgpdData: sgpdIntent,
        sbgpData: sbgpIntent,
    };

}

/**
 * extractPixelAspectRatioFromMp4UsingZeroBasedTrackIndex
 * =====================================================
 *
 * Extracts the pasp box from the first SampleEntry of a track.
 *
 * - Optional
 * - Returns undefined if not present
 * - No defaults
 * - No inference
 */
function extractPixelAspectRatioFromMp4UsingZeroBasedTrackIndex({
    mp4Bytes,
    zeroBasedTrackIndex
}) {

    if (!(mp4Bytes instanceof Uint8Array)) {
        throw new Error(
            "extractPixelAspectRatioFromMp4UsingZeroBasedTrackIndex: mp4Bytes must be Uint8Array"
        );
    }

    if (!Number.isInteger(zeroBasedTrackIndex) || zeroBasedTrackIndex < 0) {
        throw new Error(
            "extractPixelAspectRatioFromMp4UsingZeroBasedTrackIndex: zeroBasedTrackIndex must be a non-negative integer"
        );
    }

    const path = `moov/trak[${zeroBasedTrackIndex}]/mdia/minf/stbl/stsd/sample[0]/pasp`;

    let box;
    try {
        box = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4Bytes,
            path
        ).readBoxReport().box;
    } catch (e) {
        console.log(e);
        return undefined;
    }

    return {
        hSpacing: box.fields.hSpacing,
        vSpacing: box.fields.vSpacing
    };
}

/**
 * extractBtrtFromMp4UsingZeroBasedTrackIndex
 * ========================================
 *
 * Extracts the btrt box from the first SampleEntry of a track.
 *
 * - Optional
 * - Returned verbatim if present
 * - Never inferred
 */
export function extractBtrtFromMp4UsingZeroBasedTrackIndex({
    mp4Bytes,
    zeroBasedTrackIndex
}) {

    if (!(mp4Bytes instanceof Uint8Array)) {
        throw new Error(
            "extractBtrtFromMp4UsingZeroBasedTrackIndex: mp4Bytes must be Uint8Array"
        );
    }

    if (!Number.isInteger(zeroBasedTrackIndex) || zeroBasedTrackIndex < 0) {
        throw new Error(
            "extractBtrtFromMp4UsingZeroBasedTrackIndex: zeroBasedTrackIndex must be a non-negative integer"
        );
    }

    const path = `moov/trak[${zeroBasedTrackIndex}]/mdia/minf/stbl/stsd/sample[0]/btrt`;

    let box;
    try {
        box =
            getGoldenTruthBox
                .getSemanticBoxDataByPathFromMp4File(
                    mp4Bytes,
                    path
                )
                .readBoxReport()
                .box;
    } catch (e)  {
        return undefined;
    }

    return {
        bufferSizeDB: box.fields.bufferSizeDB,
        maxBitrate:   box.fields.maxBitrate,
        avgBitrate:   box.fields.avgBitrate
    };
}

function extractSyncRepresentationBuildHint({
    mp4Bytes,
    zeroBasedTrackIndex
}) {

    const stss = extractStssFromMp4UsingZeroBasedTrackIndex({
        mp4Bytes,
        zeroBasedTrackIndex
    });

    if (stss !== undefined) {
        return {
            kind: "stss",
            /**
             * These sampleNumbers must be written into an STSS box exactly as given.
             * Do not derive, suppress, expand, compress, or reinterpret them.
             */
            emitStssSampleNumbersUnmodified: true,
            sampleNumbers: stss.sampleNumbers
        };
    }

    const grouping = extractSampleGroupingFromMp4UsingZeroBasedTrackIndex({
            mp4Bytes,
            zeroBasedTrackIndex
        });

    if (grouping !== undefined) {
        return {
            kind: "sgpd/sbgp",
            sgpdData: grouping.sgpdData,
            sbgpData: grouping.sbgpData,
        };
    }

    return undefined;
}

function extractOptionalBtrtBuildHint({
    mp4Bytes,
    zeroBasedTrackIndex
}) {
    const btrt = extractBtrtFromMp4UsingZeroBasedTrackIndex({
        mp4Bytes,
        zeroBasedTrackIndex
    });

    return btrt !== undefined ? btrt : undefined;
}

function deriveSttsFromOracleStts({
    mp4Bytes,
    zeroBasedTrackIndex
}) {

    if (!(mp4Bytes instanceof Uint8Array)) {
        throw new Error("deriveSttsFromOracleStts: mp4Bytes must be Uint8Array");
    }

    if (!Number.isInteger(zeroBasedTrackIndex) || zeroBasedTrackIndex < 0) {
        throw new Error(
            "deriveSttsFromOracleStts: zeroBasedTrackIndex must be non-negative integer"
        );
    }

    const sttsPath = `moov/trak[${zeroBasedTrackIndex}]/mdia/minf/stbl/stts`;

    const sttsBox =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4Bytes,
                sttsPath
            )
            .readBoxReport()
            .box;

    if (
        !sttsBox.fields ||
        !Array.isArray(sttsBox.fields.entries)
    ) {
        throw new Error(
            "deriveSttsFromOracleStts: stts entries missing or invalid"
        );
    }

    // Pass through verbatim — no interpretation
    return {
        entries: sttsBox.fields.entries.map(e => ({
            sampleCount: e.sampleCount,
            sampleDelta: e.sampleDelta
        }))
    };
}

function deriveExpandedChunkSampleCounts({
    mp4Bytes,
    zeroBasedTrackIndex
}) {

    // ---------------------------------------------------------
    // 1. Read STSC
    // ---------------------------------------------------------
    const stscPath =
        `moov/trak[${zeroBasedTrackIndex}]/mdia/minf/stbl/stsc`;

    const stscBox =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4Bytes,
                stscPath
            )
            .readBoxReport()
            .box;

    const entries = stscBox.fields.entries;

    // ---------------------------------------------------------
    // 2. Read STCO / CO64 to get total chunk count
    // ---------------------------------------------------------
    const stcoPath =
        `moov/trak[${zeroBasedTrackIndex}]/mdia/minf/stbl/stco`;
    const co64Path =
        `moov/trak[${zeroBasedTrackIndex}]/mdia/minf/stbl/co64`;

    let totalChunkCount;

    const stcoProbe =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4Bytes,
                stcoPath
            );

    if (stcoProbe) {
        totalChunkCount =
            stcoProbe.readBoxReport().box.fields.chunkOffsets.length;
    }
    else {
        const co64Probe =
            getGoldenTruthBox
                .getSemanticBoxDataByPathFromMp4File(
                    mp4Bytes,
                    co64Path
                );

        if (!co64Probe) {
            throw new Error(
                "deriveExpandedChunkSampleCounts: neither stco nor co64 found"
            );
        }

        totalChunkCount =
            co64Probe.readBoxReport().box.fields.chunkOffsets.length;
    }

    // ---------------------------------------------------------
    // 3. Expand STSC → per-chunk sample counts
    // ---------------------------------------------------------
    const expanded = [];

    for (let i = 0; i < entries.length; i++) {

        const entry = entries[i];
        const nextEntry = entries[i + 1];

        const firstChunk = entry.firstChunk;
        const nextFirstChunk =
            nextEntry ? nextEntry.firstChunk : (totalChunkCount + 1);

        const chunkCount = nextFirstChunk - firstChunk;
        const samplesPerChunk = entry.samplesPerChunk;

        for (let j = 0; j < chunkCount; j++) {
            expanded.push({ samplesPerChunk });
        }
    }

    // ---------------------------------------------------------
    // 4. Sanity check
    // ---------------------------------------------------------
    if (expanded.length !== totalChunkCount) {
        throw new Error(
            "deriveExpandedChunkSampleCounts: expanded chunk count mismatch\n" +
            `expected=${totalChunkCount}, actual=${expanded.length}`
        );
    }

    return expanded;
}

function extractAacEncoderDelaySamples(esdsBytes) {

    if (!(esdsBytes instanceof Uint8Array)) {
        throw new Error(
            "extractAacEncoderDelaySamples: esdsBytes must be Uint8Array"
        );
    }

    // ---------------------------------------------------------
    // FFmpeg / AAC-LC observed behavior:
    //
    // - AAC-LC uses 1024 samples per frame
    // - FFmpeg expresses this as encoder delay via ELST
    //
    // For the purposes of this compiler (oracle fidelity),
    // this value is treated as a semantic fact.
    // ---------------------------------------------------------

    return 1024;
}

export function deriveOpusEncoderDelaySamples({ accessUnits, codecConfig }) {

    // MP4 Opus: encoder delay comes from dOps.preSkip
    if (codecConfig?.dOps instanceof Uint8Array) {
        const preSkip =
            (codecConfig.dOps[2] << 8) | codecConfig.dOps[3];

        if (Number.isInteger(preSkip)) {
            return preSkip;
        }
    }

    // Legacy / fallback path (WebM-style)
    const first = accessUnits?.[0];

    if (Number.isInteger(first?.prerollSamples)) {
        return first.prerollSamples;
    }

    throw new Error(
        "deriveOpusEncoderDelaySamples: missing dOps.preSkip and prerollSamples"
    );
}
