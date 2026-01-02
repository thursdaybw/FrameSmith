/**
 * Golden MP4 Test Client
 * =====================
 *
 * PURPOSE
 * -------
 *
 * Supplies a valid Mp4BuildInput by extracting
 * observable encoding facts from a known-good MP4 file.
 *
 * This client exists to support:
 *   - end-to-end conformance tests
 *   - oracle fidelity verification
 *
 * It is NOT a general-purpose demuxer.
 * It is NOT production code.
 *
 * The AUTHORITATIVE Mp4BuildInput contract is defined on:
 *   createMp4FromInputs(...)
 *
 * This file MUST NOT redefine that contract.
 *
 * ------------------------------------------------------------------
 * Role and Scope
 * ------------------------------------------------------------------
 *
 * This client treats the MP4 as:
 *   - historical encoder output
 *   - not a specification
 *   - not a policy source
 *
 * It extracts only values that are:
 *   - directly observable in the file
 *   - required by the Mp4BuildInput grammar
 *
 * If a required value cannot be extracted,
 * this client MUST FAIL.
 *
 * ------------------------------------------------------------------
 * Responsibilities
 * ------------------------------------------------------------------
 *
 * This client:
 *   - extracts semantic access unit facts (pts, isKey)
 *   - extracts opaque access unit payload bytes
 *   - extracts raw codec configuration (avcC)
 *   - extracts required buildParameters (dimensions, timescale)
 *
 * This client:
 *   - does NOT apply container policy
 *   - does NOT invent defaults
 *   - does NOT derive missing values
 *   - does NOT interpret codec bitstreams
 *
 * ------------------------------------------------------------------
 * Architectural Notes
 * ------------------------------------------------------------------
 *
 * - semanticCore contains NO byte payloads
 * - payload bytes remain opaque
 * - any container-level choices present in the MP4
 *   are treated as historical facts, not policy
 *
 * This client exists solely to supply inputs to the compiler
 * for testing and comparison purposes.
 */

import { extractSemanticAccessUnitsFromMp4 }
    from "../reference/extractSemanticAccessUnitsFromMp4.js";

import { extractAccessUnitPayloadsFromMp4 }
    from "../reference/extractAccessUnitPayloadsFromMp4.js";

import { getGoldenTruthBox }
    from "../goldenTruthExtractors/index.js";

import { extractBoxByPathFromMp4 }
    from "../reference/BoxExtractor.js";

/**
 * Golden MP4 → Mp4BuildInput
 *
 * @param {Object} params
 * @param {Uint8Array} params.mp4Bytes
 */
export async function runGoldenMp4TestClient({ mp4Bytes }) {

    if (!(mp4Bytes instanceof Uint8Array)) {
        throw new Error(
            "GoldenMp4TestClient: mp4Bytes must be Uint8Array"
        );
    }

    // ---------------------------------------------------------
    // Access units (encoder-visible facts)
    // ---------------------------------------------------------

    const samples =
        extractSemanticAccessUnitsFromMp4({ mp4Bytes });

    const accessUnitPayloads =
        extractAccessUnitPayloadsFromMp4({ mp4Bytes });

    if (!Array.isArray(samples) || samples.length === 0) {
        throw new Error(
            "GoldenMp4TestClient: no samples extracted"
        );
    }

    if (!Array.isArray(accessUnitPayloads)) {
        throw new Error(
            "GoldenMp4TestClient: missing access unit payloads"
        );
    }

    if (samples.length !== accessUnitPayloads.length) {
        throw new Error(
            "GoldenMp4TestClient: sample/payload count mismatch"
        );
    }

    // ---------------------------------------------------------
    // Semantic access units (NO BYTES)
    // ---------------------------------------------------------

    const accessUnits = samples.map((sample, index) => {

        if (typeof sample.pts !== "number") {
            throw new Error(
                `GoldenMp4TestClient: accessUnits[${index}].pts missing`
            );
        }

        if (typeof sample.isKey !== "boolean") {
            throw new Error(
                `GoldenMp4TestClient: accessUnits[${index}].isKey missing`
            );
        }

        return {
            pts: sample.pts,
            isKey: sample.isKey
        };
    });

    // ---------------------------------------------------------
    // Codec configuration (semantic only)
    // ---------------------------------------------------------

    const stsd =
        getGoldenTruthBox
            .fromMp4(
                mp4Bytes,
                "moov/trak/mdia/minf/stbl/stsd"
            )
            .getBuilderInput();

    if (!stsd?.codec) {
        throw new Error(
            "GoldenMp4TestClient: codec.codec missing"
        );
    }

    if (!(stsd.avcC instanceof Uint8Array)) {
        throw new Error(
            "GoldenMp4TestClient: codec.avcC missing"
        );
    }

    const codec = {
        codec: stsd.codec,
        avcC: stsd.avcC,
        avcCCompleteness: "container-complete"
    };

    // ---------------------------------------------------------
    // Build hints (observable container facts)
    // ---------------------------------------------------------

    const buildHints = {};

    const udtaBytes =
        extractBoxByPathFromMp4(
            mp4Bytes,
            "moov/udta"
        );

    if (!(udtaBytes instanceof Uint8Array)) {
        throw new Error(
            "GoldenMp4TestClient: udta box missing or invalid"
        );
    }

    buildHints.udtaBytes = udtaBytes;

    if (stsd.btrt) {
        buildHints.btrt = {
            bufferSizeDB: stsd.btrt.bufferSizeDB,
            maxBitrate:   stsd.btrt.maxBitrate,
            avgBitrate:   stsd.btrt.avgBitrate
        };
    }

    if (typeof stsd.compressorName === "string") {
        buildHints.compressorName = stsd.compressorName;
    }

    // ---------------------------------------------------------
    // Build parameters (required, non-semantic)
    // ---------------------------------------------------------

    const tkhd =
        getGoldenTruthBox
            .fromMp4(
                mp4Bytes,
                "moov/trak/tkhd"
            )
            .getBuilderInput();

    const mdhd =
        getGoldenTruthBox
            .fromMp4(
                mp4Bytes,
                "moov/trak/mdia/mdhd"
            )
            .getBuilderInput();

    const mvhd =
        getGoldenTruthBox
            .fromMp4(
                mp4Bytes,
                "moov/mvhd"
            )
            .getBuilderInput();

    if (!Number.isInteger(mvhd.timescale)) {
        throw new Error(
            "GoldenMp4TestClient: mvhd.timescale missing or invalid"
        );
    }

    const buildParameters = {
        codedWidth: tkhd.width,
        codedHeight: tkhd.height,
        trackTimescale: mdhd.timescale
    };

    const semanticHints = {
        movieTimescale: mvhd.timescale
    };

    console.log(
        "DEBUG golden semanticHints:",
        semanticHints
    );

    // ---------------------------------------------------------
    // Final Mp4BuildInput
    // ---------------------------------------------------------

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

        semanticHints
    };

}
