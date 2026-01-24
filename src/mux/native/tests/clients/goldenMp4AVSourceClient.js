import { extractSemanticAccessUnitsFromMp4 } from "../reference/extractSemanticAccessUnitsFromMp4.js";

import { extractAccessUnitPayloadsFromMp4 }
    from "../reference/extractAccessUnitPayloadsFromMp4.js";

import {
    extractTrackCodecConfigurationFromMp4UsingZeroBasedTrackIndex
} from "../reference/extractTrackCodecConfigurationFromMp4UsingZeroBasedTrackIndex.js";

import {
    extractTrackBuildParametersFromMp4UsingZeroBasedTrackIndex
} from "../reference/extractTrackBuildParametersFromMp4UsingZeroBasedTrackIndex.js";

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

    buildHints.compressorName = getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(mp4Bytes, "moov/trak[0]/mdia/minf/stbl/stsd/sample[0]")
            .getEmitterInput().compressorName;

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

function extractVideoTrackFromMp4({ mp4Bytes }) {

    const accessUnits = extractSemanticAccessUnitsFromMp4({
        mp4Bytes,
        trackIndex: 0
    });

    const accessUnitPayloads = extractAccessUnitPayloadsFromMp4({
        mp4Bytes,
        trackIndex: 0
    });

    if (!Array.isArray(accessUnits) || accessUnits.length === 0) {
        throw new Error("GoldenMp4AVTestClient: no video accessUnits extracted");
    }

    if (!Array.isArray(accessUnitPayloads)) {
        throw new Error("GoldenMp4AVTestClient: missing video payloads");
    }

    if (accessUnits.length !== accessUnitPayloads.length) {
        throw new Error("GoldenMp4AVTestClient: video sample/payload count mismatch");
    }

    const codec = extractTrackCodecConfigurationFromMp4UsingZeroBasedTrackIndex({
            mp4Bytes,
            zeroBasedTrackIndex: 0
        });

    const buildParameters = extractTrackBuildParametersFromMp4UsingZeroBasedTrackIndex({
            mp4Bytes,
            zeroBasedTrackIndex: 0
        });

    const buildHints = {};

    const syncRepresentation = extractSyncRepresentationBuildHint({
            mp4Bytes,
            zeroBasedTrackIndex: 0
        });

    if (syncRepresentation !== undefined) {
        buildHints.syncRepresentation = syncRepresentation;
    }

    // Optional container compatibility hints (oracle passthrough)
    const pasp = extractPixelAspectRatioFromMp4UsingZeroBasedTrackIndex({
        mp4Bytes,
        zeroBasedTrackIndex: 0
    });

    if (pasp !== undefined) {
        buildHints.pasp = pasp;
    }

    const btrt = extractOptionalBtrtBuildHint({ mp4Bytes, zeroBasedTrackIndex: 0 });

    if (btrt !== undefined) {
        buildHints.btrt = btrt;
    }

    // HARD-CODE oracle chunking for now
    buildHints.chunkingStrategy = "one-sample-per-chunk";

    return {
        semanticCore: {
            accessUnits,
            codec
        },

        payloads: {
            accessUnitPayloads
        },

        buildParameters,

        buildHints
    };
}

function extractAudioTrackFromMp4({ mp4Bytes }) {

    const accessUnits = extractSemanticAccessUnitsFromMp4({
        mp4Bytes,
        trackIndex: 1
    });

    const accessUnitPayloads = extractAccessUnitPayloadsFromMp4({
        mp4Bytes,
        trackIndex: 1
    });

    if (!Array.isArray(accessUnits) || accessUnits.length === 0) {
        throw new Error("GoldenMp4AVTestClient: no audio accessUnits extracted");
    }

    if (accessUnits.length !== accessUnitPayloads.length) {
        throw new Error("GoldenMp4AVTestClient: audio sample/payload count mismatch");
    }

    const codecConfig = extractTrackCodecConfigurationFromMp4UsingZeroBasedTrackIndex({
            mp4Bytes,
            zeroBasedTrackIndex: 1
        });

    const buildParameters = extractTrackBuildParametersFromMp4UsingZeroBasedTrackIndex({ mp4Bytes, zeroBasedTrackIndex: 1 });

    // Audio shape symmetry with WebCodecs
    if (codecConfig.channelCount !== undefined) {
        buildParameters.channelCount = codecConfig.channelCount;
    }

    if (codecConfig.sampleRate !== undefined) {
        buildParameters.sampleRate = codecConfig.sampleRate;
    }

    const semanticHints = {};

    semanticHints.packetRuns = derivePacketRunsFromOracleStsc({ mp4Bytes, zeroBasedTrackIndex: 1 });

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

    // HARD-CODE oracle chunking for now
    //buildHints.chunkingStrategy = "all-samples-one-chunk";
    buildHints.chunkingStrategy = "packetized";

    buildHints.sttsPolicy = "oracle-faithful";

    return {
        semanticCore: {
            accessUnits,
            codec: {
                codec: codecConfig.codec,
                esds: codecConfig.esds
            }
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

function derivePacketRunsFromOracleStsc({
    mp4Bytes,
    zeroBasedTrackIndex
}) {

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
    const packetRuns = [];

    for (let i = 0; i < entries.length; i++) {

        const entry = entries[i];
        const nextEntry = entries[i + 1];

        const firstChunk = entry.firstChunk;
        const nextFirstChunk =
            nextEntry ? nextEntry.firstChunk : firstChunk + 1;

        const chunkCount = nextFirstChunk - firstChunk;
        const samplesPerChunk = entry.samplesPerChunk;

        for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {
            packetRuns.push({
                samplesPerChunk
            });
        }
    }

    return packetRuns;
}
