/**
 * HVC1 — Visual Sample Entry (Golden Truth Extractor)
 * ==================================================
 *
 * Reports LOSSLESS, STRUCTURAL truth for an `hvc1`
 * SampleEntry box.
 *
 * - Reads only on-disk fields
 * - Preserves child boxes
 * - Performs no semantic interpretation
 * - Applies no policy
 *
 * SampleEntry boxes are a STRUCTURAL EXCEPTION:
 * - child boxes begin after a codec-defined fixed header
 * - handled explicitly via SampleEntryReader
 */

import {
    readUint16,
    readUint32
} from "../../bytes/mp4ByteReader.js";

import { SampleEntryReader } from "../../reference/SampleEntryReader.js";

import {
    getPayloadOffsetForPath
} from "../../box-schema/boxSchemas.js";

// ---------------------------------------------------------------------------
// readBoxReport (structural truth)
// ---------------------------------------------------------------------------

function readBoxReport(box) {
    if (!(box instanceof Uint8Array)) {
        throw new Error("hvc1.readBoxReport: expected Uint8Array");
    }

    const path = "moov/trak/mdia/minf/stbl/stsd|hvc1";
    const payloadOffset = getPayloadOffsetForPath(path);
    let cursor = payloadOffset;

    const reserved0 = box[cursor++];
    const reserved1 = box[cursor++];
    const reserved2 = box[cursor++];
    const reserved3 = box[cursor++];
    const reserved4 = box[cursor++];
    const reserved5 = box[cursor++];

    const dataReferenceIndex = readUint16(box, cursor); cursor += 2;

    const preDefined1 = readUint16(box, cursor);
    const reserved6  = readUint16(box, cursor + 2);
    cursor += 4;

    const preDefined2 = readUint32(box, cursor); cursor += 4;
    const preDefined3 = readUint32(box, cursor); cursor += 4;
    const preDefined4 = readUint32(box, cursor); cursor += 4;

    const width  = readUint16(box, cursor); cursor += 2;
    const height = readUint16(box, cursor); cursor += 2;

    const horizResolution = readUint32(box, cursor); cursor += 4;
    const vertResolution  = readUint32(box, cursor); cursor += 4;

    const reserved7 = readUint32(box, cursor); cursor += 4;

    const frameCount = readUint16(box, cursor); cursor += 2;

    const compressorNameLength = box[cursor];
    const compressorNameBytes =
        Array.from(box.slice(cursor + 1, cursor + 32));
    cursor += 32;

    const depth       = readUint16(box, cursor); cursor += 2;
    const preDefined5 = readUint16(box, cursor); cursor += 2;

    const reader = new SampleEntryReader(box, "hvc1");

    const children = {};
    for (const { type, offset, size } of reader.enumerateChildren()) {
        children[type] = { type, raw: box.slice(offset, offset + size) };
    }

    let derivedHvcC;

    if (children.hvcC) {
        derivedHvcC =
            getHvcCWithoutHeaderFromRawHvcC(
                children.hvcC.raw
            );
    }

    return {
        raw: box,
        box: {
            type: "hvc1",
            fields: {
                reserved0, reserved1, reserved2, reserved3, reserved4, reserved5,
                dataReferenceIndex,
                preDefined1, reserved6,
                preDefined2, preDefined3, preDefined4,
                width, height,
                horizResolution, vertResolution,
                reserved7,
                frameCount,
                compressorNameLength,
                compressorNameBytes,
                depth,
                preDefined5
            },
            children
        },
        derived: {
            ...(derivedHvcC ? { hvcC: derivedHvcC } : {})
        }
    };
}

function getHvcCWithoutHeaderFromRawHvcC(rawHvcC) {
    if (!(rawHvcC instanceof Uint8Array)) {
        throw new Error(
            "getHvcCWithoutHeaderFromRawHvcC: expected Uint8Array"
        );
    }

    const payloadOffset =
        getPayloadOffsetForPath(
            "moov/trak/mdia/minf/stbl/stsd|hvc1/hvcC"
        );

    return rawHvcC.slice(payloadOffset);
}

// ---------------------------------------------------------------------------
// getEmitterInput (compiler intent)
// ---------------------------------------------------------------------------

function getEmitterInput(box) {
    const read = readBoxReport(box);

    const {
        width,
        height,
        compressorNameLength,
        compressorNameBytes
    } = read.box.fields;

    const compressorName =
        new TextDecoder().decode(
            Uint8Array.from(
                compressorNameBytes.slice(0, compressorNameLength)
            )
        );

    const hvcCPayloadWithoutHeader =
        getHvcCPayloadWithoutHeaderFromRaw(
            read.box.children.hvcC.raw
        );

    return {
        width,
        height,
        compressorName,

        hvcC: hvcCPayloadWithoutHeader,

        pasp: read.box.children.pasp
        ? {
            hSpacing: readUint32(read.box.children.pasp.raw, 8),
            vSpacing: readUint32(read.box.children.pasp.raw, 12)
        }
        : undefined,

        btrt: read.box.children.btrt
        ? {
            bufferSizeDB: readUint32(read.box.children.btrt.raw, 8),
            maxBitrate:   readUint32(read.box.children.btrt.raw, 12),
            avgBitrate:   readUint32(read.box.children.btrt.raw, 16)
        }
        : undefined
    };
}

function getHvcCPayloadWithoutHeaderFromRaw(raw) {
    const payloadOffset =
        getPayloadOffsetForPath(
            "moov/trak/mdia/minf/stbl/stsd|hvc1/hvcC"
        );

    return raw.slice(payloadOffset);
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerHvc1SampleEntryGoldenTruthExtractor(register) {
    register.readBoxReport(readBoxReport);
    register.getEmitterInput(getEmitterInput);
}
