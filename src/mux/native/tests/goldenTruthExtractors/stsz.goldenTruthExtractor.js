import { readUint32 } from "../../bytes/mp4ByteReader.js";
import {
    readUint32ArrayFromOffset,
    readBoxHeaderFromBytes
} from "../../box-schema/boxLayoutReaders.js";
import {
    getPayloadOffsetForPath
} from "../../box-schema/boxSchemas.js";

import { PRIMITIVE_SIZES } from "../../box-schema/primitiveLayouts.js";
/**
 * STSZ — Sample Size Box
 * ---------------------
 *
 * Layout (ISO/IEC 14496-12):
 *
 *   uint32 sample_size
 *   uint32 sample_count
 *   uint32[sample_count] sample_sizes
 *
 * Contract:
 * ---------
 * - readBoxReport() exposes LOSSLESS on-disk structure
 * - No inference
 * - No reuse of incompatible generic readers
 */

// ---------------------------------------------------------------------------
// readBoxReport (structural truth)
// ---------------------------------------------------------------------------

function readBoxReport(box) {
    if (!(box instanceof Uint8Array)) {
        throw new Error("stsz.readBoxReport: expected Uint8Array");
    }

    const path = "moov/trak/mdia/minf/stbl/stsz";

    const header = readBoxHeaderFromBytes(box, path);
    const payloadOffset = getPayloadOffsetForPath(path);

    const UINT32 = PRIMITIVE_SIZES.uint32;

    const sampleSize  = readUint32(box, payloadOffset);
    const sampleCount = readUint32(box, payloadOffset + UINT32);

    let sizes;

    if (sampleSize !== 0) {
        // constant-size samples: expand deterministically
        sizes = new Array(sampleCount).fill(sampleSize);
    } else {
        // variable-size samples: read table
        sizes = readUint32ArrayFromOffset({
            box,
            payloadOffset: payloadOffset + UINT32,
            count: sampleCount
        });
    }

    return {
        raw: box,

        box: {
            type: "stsz",
            header,
            fields: {
                sampleSize,
                sampleCount,
                sizes
            }
        },

        derived: {}
    };
}

// ---------------------------------------------------------------------------
// getEmitterInput (compiler intent)
// ---------------------------------------------------------------------------
function getEmitterInput(boxBytes) {
    const read = readBoxReport(boxBytes);

    const sampleSize  = read.box.fields.sampleSize;
    const sampleCount = read.box.fields.sampleCount;

    if (sampleSize === 0) {
        // Variable-size STSZ
        return {
            sampleSize: 0,
            sampleCount,
            sizes: read.box.fields.sizes.slice()
        };
    }

    // Fixed-size STSZ
    return {
        sampleSize,
        sampleCount
    };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerStszGoldenTruthExtractor(register) {
    register.readBoxReport(readBoxReport);
    register.getEmitterInput(getEmitterInput);
}
