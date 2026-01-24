/**
 * MP4A — Audio Sample Entry (Golden Truth Extractor)
 * =================================================
 *
 * Structural extractor for mp4a SampleEntry.
 *
 * - Reads only on-disk fields
 * - Preserves child boxes as child boxes
 * - Performs no semantic interpretation
 * - Applies no policy
 *
 * SampleEntry boxes are a STRUCTURAL EXCEPTION:
 * - child boxes begin after a codec-defined fixed header
 * - this exception is handled explicitly via SampleEntryReader
 */

import {
    readUint16,
    readUint32
} from "../../bytes/mp4ByteReader.js";

import {
    SampleEntryReader,
    getSampleEntryHeaderSize
} from "../../reference/SampleEntryReader.js";

import {
    getPayloadOffsetForPath
} from "../../box-schema/boxSchemas.js";

import { getOpaquePayloadFromBytes } from "../../box-schema/boxLayoutReaders.js";

// ---------------------------------------------------------------------------
// readBoxReport (structural truth)
// ---------------------------------------------------------------------------
function readBoxReport(box) {

    if (!(box instanceof Uint8Array)) {
        throw new Error("mp4a.readBoxReport: expected Uint8Array");
    }

    const path = "moov/trak/mdia/minf/stbl/stsd|mp4a";

    // SampleEntry payload begins immediately after basic box header
    const payloadOffset = getPayloadOffsetForPath(path);
    let cursor = payloadOffset;

    // ---------------------------------------------------------------------
    // AudioSampleEntry fixed fields (ISO/IEC 14496-12)
    // ---------------------------------------------------------------------

    // reserved[6]
    const reserved1 = box[cursor++];
    const reserved2 = box[cursor++];
    const reserved3 = box[cursor++];
    const reserved4 = box[cursor++];
    const reserved5 = box[cursor++];
    const reserved6 = box[cursor++];

    // data_reference_index
    const dataReferenceIndex = readUint16(box, cursor);
    cursor += 2;

    // reserved / pre_defined (uint32, uint32)
    const reserved7 = readUint32(box, cursor);
    cursor += 4;

    const reserved8 = readUint32(box, cursor);
    cursor += 4;

    // AudioSampleEntry fields
    const channelCount = readUint16(box, cursor);
    cursor += 2;

    const sampleSize = readUint16(box, cursor);
    cursor += 2;

    const preDefined1 = readUint16(box, cursor);
    cursor += 2;

    const preDefined2 = readUint16(box, cursor);
    cursor += 2;

    // sampleRate (16.16 fixed-point, stored as uint32)
    const sampleRate = readUint32(box, cursor);
    cursor += 4;

    // ---------------------------------------------------------------------
    // Child boxes (SampleEntry structural exception)
    // ---------------------------------------------------------------------

    const reader =
        new SampleEntryReader(
            box,
            getSampleEntryHeaderSize("mp4a")
        );

    const children = {};

    for (const { type, offset, size } of reader.enumerateChildren()) {
        children[type] = {
            type,
            raw: box.slice(offset, offset + size)
        };
    }

    // ---------------------------------------------------------------------
    // Derived views (semantic, deterministic)
    // ---------------------------------------------------------------------

    let derivedEsds;

    if (children.esds) {

        derivedEsds =
            getOpaquePayloadFromBytes(
                children.esds.raw,
                "moov/trak/mdia/minf/stbl/stsd|mp4a/esds"
            );
    }

    return {
        raw: box,

        box: {
            type: "mp4a",
            fields: {
                reserved1,
                reserved2,
                reserved3,
                reserved4,
                reserved5,
                reserved6,
                dataReferenceIndex,
                reserved7,
                reserved8,
                channelCount,
                sampleSize,
                preDefined1,
                preDefined2,
                sampleRate
            },
            children
        },

        derived: {
            ...(derivedEsds ? { esds: derivedEsds } : {})
        }
    };
}

// ---------------------------------------------------------------------------
// getEmitterInput (compiler intent)
// ---------------------------------------------------------------------------

function getEmitterInput(box) {
    const read = readBoxReport(box);

    return {
        channelCount: read.box.fields.channelCount,
        sampleSize:   read.box.fields.sampleSize,
        sampleRate:   read.box.fields.sampleRate,

        // FIX: pass the derived opaque payload, not the full esds box bytes
        esds: read.derived.esds,

        btrt: read.box.children.btrt
            ? {
                bufferSizeDB: readUint32(read.box.children.btrt.raw, 8),
                maxBitrate:   readUint32(read.box.children.btrt.raw, 12),
                avgBitrate:   readUint32(read.box.children.btrt.raw, 16)
            }
            : undefined
    };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerMp4aSampleEntryGoldenTruthExtractor(register) {
    register.readBoxReport(readBoxReport);
    register.getEmitterInput(getEmitterInput);
}
