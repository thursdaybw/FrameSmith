/**
 * stss — Sync Sample Box (Golden Truth Extractor)
 * ---------------------
 *
 * Declares which samples are random access points (keyframes).
 *
 * Semantics:
 * ----------
 * - Contains a table of 1-based sample numbers
 * - Absence of stss means "all samples are sync samples"
 *
 * IMPORTANT:
 * ----------
 * This extractor does NOT infer that behavior.
 * If stss exists, it is treated as authoritative.
 *
 * No traversal.
 * No policy.
 * No normalization.
 *
 * Layout (ISO/IEC 14496-12):
 *
 *   uint32 entry_count
 *   uint32[entry_count] sample_numbers
 *
 * Contract:
 * ---------
 * - readBoxReport() exposes LOSSLESS on-disk structure
 * - No inference
 * - No collapsing of fields
 */
import { readUint32 } from "../../bytes/mp4ByteReader.js";
import { readBoxHeaderFromBytes } from "../../box-schema/boxLayoutReaders.js";
import { getPayloadOffsetForPath } from "../../box-schema/boxSchemas.js";
import { readUint32ArrayFromOffset } from "../../box-schema/boxLayoutReaders.js";

function readBoxReport(box) {
    if (!(box instanceof Uint8Array)) {
        throw new Error("stss.readBoxReport: expected Uint8Array");
    }

    const path = "moov/trak/mdia/minf/stbl/stss";

    const header = readBoxHeaderFromBytes(box, path);
    const payloadOffset = getPayloadOffsetForPath(path);

    const entryCount = readUint32(box, payloadOffset);

    const sampleNumbers = readUint32ArrayFromOffset({
        box,
        payloadOffset,
        count: entryCount
    });

    return {
        raw: box,

        box: {
            type: "stss",
            header,
            fields: {
                entryCount,
                sampleNumbers
            }
        },

        derived: {}
    };
}

// ---------------------------------------------------------------------------
// getEmitterInput (compiler intent)
// ---------------------------------------------------------------------------

function getEmitterInput(box) {
    const read = readBoxReport(box);

    return {
        sampleNumbers: read.box.fields.sampleNumbers.slice()
    };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerStssGoldenTruthExtractor(register) {
    register.readBoxReport(readBoxReport);
    register.getEmitterInput(getEmitterInput);
}
