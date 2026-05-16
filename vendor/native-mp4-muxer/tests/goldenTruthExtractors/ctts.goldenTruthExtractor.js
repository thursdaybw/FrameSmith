/**
 * CTTS — Composition Time to Sample Box
 *
 * Layout (ISO/IEC 14496-12, version 0):
 *
 *   uint32 entry_count
 *   {
 *     uint32 sample_count
 *     uint32 sample_offset
 *   } × entry_count
 *
 * Contract:
 * ---------
 * - readBoxReport() exposes LOSSLESS on-disk structure
 * - No inference
 * - No normalization
 * - Version semantics enforced (version 0 only)
 */

import { readUint32 } from "../../bytes/mp4ByteReader.js";

import {
    readBoxHeaderFromBytes
} from "../../box-schema/boxLayoutReaders.js";

import {
    getPayloadOffsetForPath
} from "../../box-schema/boxSchemas.js";

import { PRIMITIVE_SIZES } from "../../box-schema/primitiveLayouts.js";

// ---------------------------------------------------------------------------
// readBoxReport (structural truth)
// ---------------------------------------------------------------------------

function readBoxReport(box) {
    if (!(box instanceof Uint8Array)) {
        throw new Error("ctts.readBoxReport: expected Uint8Array");
    }

    const path = "moov/trak/mdia/minf/stbl/ctts";

    const header = readBoxHeaderFromBytes(box, path);

    if (header.version !== 0) {
        throw new Error(
            `ctts.readBoxReport: unsupported version ${header.version} (expected 0)`
        );
    }

    const payloadOffset = getPayloadOffsetForPath(path);

    const entryCount = readUint32(box, payloadOffset);

    const entries = readCttsEntriesFromOffset({
        box,
        payloadOffset,
        count: entryCount
    });

    return {
        raw: box,

        box: {
            type: "ctts",
            header,
            fields: {
                entryCount,
                entries
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
        entries: read.box.fields.entries.map(e => ({
            count:  e.count,
            offset: e.offset
        }))
    };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readCttsEntriesFromOffset({
    box,
    payloadOffset,
    count
}) {
    const UINT32_SIZE = PRIMITIVE_SIZES.uint32;
    const values = [];

    let cursor = payloadOffset + UINT32_SIZE;

    for (let i = 0; i < count; i++) {
        const sampleCount  = readUint32(box, cursor);
        const sampleOffset = readUint32(box, cursor + UINT32_SIZE);

        values.push({
            count:  sampleCount,
            offset: sampleOffset
        });

        cursor += UINT32_SIZE * 2;
    }

    return values;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerCttsGoldenTruthExtractor(register) {
    register.readBoxReport(readBoxReport);
    register.getEmitterInput(getEmitterInput);
}
