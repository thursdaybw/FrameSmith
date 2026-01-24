/**
 * STCO — Chunk Offset Box
 *
 * Layout (ISO/IEC 14496-12):
 *
 *   uint32 entry_count
 *   uint32[entry_count] chunk_offsets
 *
 * Contract:
 * ---------
 * - readBoxReport() exposes LOSSLESS on-disk structure
 * - No inference
 * - No collapsing of fields
 */

// ---------------------------------------------------------------------------
// readBoxReport (structural truth)
// ---------------------------------------------------------------------------

import { readUint32 } from "../../bytes/mp4ByteReader.js";
import {
    readBoxHeaderFromBytes
} from "../../box-schema/boxLayoutReaders.js";
import {
    getPayloadOffsetForPath
} from "../../box-schema/boxSchemas.js";

import { PRIMITIVE_SIZES } from "../../box-schema/primitiveLayouts.js";

import { readUint32ArrayFromOffset } from "../../box-schema/boxLayoutReaders.js";
function readBoxReport(box) {
    if (!(box instanceof Uint8Array)) {
        throw new Error("stco.readBoxReport: expected Uint8Array");
    }

    const path = "moov/trak/mdia/minf/stbl/stco";

    const header = readBoxHeaderFromBytes(box, path);

    const payloadOffset = getPayloadOffsetForPath(path);

    const entryCount = readUint32(box, payloadOffset);

    const chunkOffsets = readUint32ArrayFromOffset({
        box,
        payloadOffset,
        count: entryCount
    });

    return {
        raw: box,

        box: {
            type: "stco",
            header,
            fields: {
                entryCount,
                chunkOffsets
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
        chunkOffsets: read.box.fields.chunkOffsets.slice()
    };
}

let registered = false;
// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerStcoGoldenTruthExtractor(register) {
    register.readBoxReport(readBoxReport);
    register.getEmitterInput(getEmitterInput);
}
