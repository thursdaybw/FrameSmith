/**
 * Opus — Audio Sample Entry (Golden Truth Extractor)
 * =================================================
 *
 * Structural extractor for Opus SampleEntry.
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
    getSampleEntryHeaderSize,
    getSampleEntrySchemaByType,
} from "../../reference/SampleEntryReader.js";

import {
    getOpaquePayloadFromBytes
} from "../../box-schema/boxLayoutReaders.js";

import {
    getHeaderLayoutForPath,
} from "../../box-schema/boxSchemas.js";

import {
    GoldenTruthRegistry
} from "../goldenTruthExtractors/GoldenTruthRegistry.js";




// ---------------------------------------------------------------------------
// readBoxReport (structural truth)
// ---------------------------------------------------------------------------
function readBoxReport(box) {

    if (!(box instanceof Uint8Array)) {
        throw new Error("Opus.readBoxReport: expected Uint8Array");
    }

    const path = "moov/trak/mdia/minf/stbl/stsd|Opus";

    let cursor = getHeaderLayoutForPath(path).headerSize;

    // SampleEntry
    const reserved1 = box[cursor++];
    const reserved2 = box[cursor++];
    const reserved3 = box[cursor++];
    const reserved4 = box[cursor++];
    const reserved5 = box[cursor++];
    const reserved6 = box[cursor++];

    const dataReferenceIndex =
        (box[cursor++] << 8) |
         box[cursor++];

    // AudioSampleEntry reserved / pre_defined
    const reserved7 =
        (box[cursor++] << 24) |
        (box[cursor++] << 16) |
        (box[cursor++] << 8)  |
         box[cursor++];

    const reserved8 =
        (box[cursor++] << 24) |
        (box[cursor++] << 16) |
        (box[cursor++] << 8)  |
         box[cursor++];

    // AudioSampleEntry fields
    const channelCount =
        (box[cursor++] << 8) |
         box[cursor++];

    const sampleSize =
        (box[cursor++] << 8) |
         box[cursor++];

    const preDefined1 =
        (box[cursor++] << 8) |
         box[cursor++];

    const preDefined2 =
        (box[cursor++] << 8) |
         box[cursor++];

    const sampleRate =
        (box[cursor++] << 24) |
        (box[cursor++] << 16) |
        (box[cursor++] << 8)  |
         box[cursor++];

    const reader = new SampleEntryReader( box, "mp4a");

    const children = {};

    for (const { type, offset, size } of reader.enumerateChildren()) {
        children[type] = {
            type,
            raw: box.slice(offset, offset + size)
        };
    }

    let derived = {};

    if (children.dOps) {
        derived.dOps =
            GoldenTruthRegistry
                .getExtractor("moov/trak/mdia/minf/stbl/stsd|Opus/dOps")
                .readBoxReport(children.dOps.raw)
                .raw
                .slice(
                    getHeaderLayoutForPath(
                        "moov/trak/mdia/minf/stbl/stsd|Opus/dOps"
                    ).headerSize
                );
    }

    let diagnosticsCache = undefined;

    return {
        raw: box,
        box: {
            type: "Opus",
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
        derived,

        get diagnostics() {
            if (diagnosticsCache === undefined) {
                diagnosticsCache = decodeOpusSampleEntry("Opus Sample Entry", box);
            }
            return diagnosticsCache;
        }

    };
}

// ---------------------------------------------------------------------------
// getEmitterInput (compiler intent)
// ---------------------------------------------------------------------------
function getEmitterInput(box) {
    const read = readBoxReport(box);

    if (!read.box.children.dOps) {
        throw new Error(
            "Opus.getEmitterInput: required dOps child missing"
        );
    }

    const dOpsBuilderInput = GoldenTruthRegistry
        .getExtractor("moov/trak/mdia/minf/stbl/stsd|Opus/dOps")
        .getEmitterInput(read.box.children.dOps.raw);

    const btrtBuilderInput = read.box.children.btrt
        ? GoldenTruthRegistry
        .getExtractor("moov/trak/mdia/minf/stbl/stsd|Opus/btrt")
        .getEmitterInput(read.box.children.btrt.raw)
        : undefined;

    return {
        ...read.box.fields,
        dOps: dOpsBuilderInput,
        btrt: btrtBuilderInput,
    };
}


function decodeOpusSampleEntry(label = "Opus Sample Entry", sampleEntryBytes) {

    if (!(sampleEntryBytes instanceof Uint8Array)) {
        throw new Error("decodeOpusSampleEntry: expected Uint8Array");
    }

    const headerSize = getHeaderLayoutForPath("moov/trak/mdia/minf/stbl/stsd|Opus").headerSize;

    let cursor = headerSize;

    const read8  = () => sampleEntryBytes[cursor++];
    const read16 = () => (read8() << 8) | read8();
    const read32 = () =>
        (read8() << 24) |
            (read8() << 16) |
            (read8() << 8)  |
            read8();

    // reserved[6]
    const reserved = [
        read8(), read8(), read8(),
        read8(), read8(), read8()
    ];

    const dataReferenceIndex = read16();

    const reserved7 = read32();
    const reserved8 = read32();

    const channelCount = read16();
    const sampleSize   = read16();
    const preDefined1  = read16();
    const preDefined2  = read16();

    const sampleRate1616 = read32();

    return [
        { label, field: "reserved[0..5]", value: reserved },
        { label, field: "dataReferenceIndex", value: dataReferenceIndex },
        { label, field: "reserved7", value: reserved7 },
        { label, field: "reserved8", value: reserved8 },
        { label, field: "channelCount", value: channelCount },
        { label, field: "sampleSize", value: sampleSize },
        { label, field: "preDefined1", value: preDefined1 },
        { label, field: "preDefined2", value: preDefined2 },
        {
            label,
            field: "sampleRate (16.16)",
            value: sampleRate1616,
            hex: "0x" + sampleRate1616.toString(16)
        }
    ];
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerOpusSampleEntryGoldenTruthExtractor(register) {
    register.readBoxReport(readBoxReport);
    register.getEmitterInput(getEmitterInput);
}
