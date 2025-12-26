import { readUint16, readUint32 } from "../../bytes/mp4ByteReader.js";

/**
 * AVC1 Parser
 * ===========
 *
 * Test-only parser for the H.264 Video Sample Entry (avc1).
 *
 * This parser:
 * - operates on isolated avc1 box bytes only
 * - understands VisualSampleEntry layout
 * - preserves opaque payloads verbatim
 *
 * It does NOT:
 * - traverse the MP4
 * - interpret SPS/PPS contents
 * - normalize values
 * - infer defaults
 *
 * Contract:
 * - input is a Uint8Array whose type is "avc1"
 * - all offsets are absolute within that box
 */

// ---------------------------------------------------------------------------
// Public parser surface (registered)
// ---------------------------------------------------------------------------

function readAvc1FieldsFromBoxBytes(box) {
    if (!(box instanceof Uint8Array)) {
        throw new Error("avc1.readFields: expected Uint8Array");
    }

    const type =
        String.fromCharCode(
            box[4], box[5], box[6], box[7]
        );

    if (type !== "avc1") {
        throw new Error(
            `avc1.readFields: expected 'avc1', got '${type}'`
        );
    }

    const width  = readUint16(box, 32);
    const height = readUint16(box, 34);

    const compressorName = readCompressorName(box);

    const avcCBox = extractChildBoxFromAvc1(box, "avcC");
    const btrtBox = extractChildBoxFromAvc1(box, "btrt");

    return {
        type: "avc1",

        width,
        height,
        compressorName,

        // opaque payloads
        avcC: avcCBox.slice(8),

        btrt: {
            bufferSizeDB: readUint32(btrtBox, 8),
            maxBitrate:   readUint32(btrtBox, 12),
            avgBitrate:   readUint32(btrtBox, 16)
        },

        raw: box
    };
}

function getAvc1BuildParamsFromBoxBytes(box) {
    const fields = readAvc1FieldsFromBoxBytes(box);

    return {
        width:          fields.width,
        height:         fields.height,
        compressorName: fields.compressorName,
        avcC:           fields.avcC,
        btrt:           fields.btrt
    };
}

export function registerAvc1GoldenTruthExtractor(register) {
    register.readFields(readAvc1FieldsFromBoxBytes);
    register.getBuilderInput(getAvc1BuildParamsFromBoxBytes);
}

// ---------------------------------------------------------------------------
// VisualSampleEntry helpers (PRIVATE, codec-owned)
// ---------------------------------------------------------------------------

/**
 * Extracts a child box from an avc1 VisualSampleEntry.
 *
 * VisualSampleEntry layout:
 * - size (4)
 * - type (4)
 * - reserved (6)
 * - data_reference_index (2)
 * - pre_defined / reserved (16)
 * - width (2)
 * - height (2)
 * - horizresolution (4)
 * - vertresolution (4)
 * - reserved (4)
 * - frame_count (2)
 * - compressorname (32)
 * - depth (2)
 * - pre_defined (-1) (2)
 * -----------------------------------------------
 * = 78 bytes fixed preamble
 *
 * Child boxes begin at offset: 8 + 78
 */
function extractChildBoxFromAvc1(avc1Box, fourcc) {
    const childrenOffset = 8 + 78;

    if (avc1Box.length < childrenOffset + 8) {
        throw new Error(
            "avc1: invalid VisualSampleEntry layout"
        );
    }

    let offset = childrenOffset;

    while (offset + 8 <= avc1Box.length) {
        const size =
            (avc1Box[offset]     << 24) |
            (avc1Box[offset + 1] << 16) |
            (avc1Box[offset + 2] << 8)  |
            avc1Box[offset + 3];

        const type =
            String.fromCharCode(
                avc1Box[offset + 4],
                avc1Box[offset + 5],
                avc1Box[offset + 6],
                avc1Box[offset + 7]
            );

        if (type === fourcc) {
            return avc1Box.slice(offset, offset + size);
        }

        if (size < 8) break;
        offset += size;
    }

    throw new Error(
        `avc1: child box '${fourcc}' not found`
    );
}

// ---------------------------------------------------------------------------
// Legacy VisualSampleEntry compressorname reader
// ---------------------------------------------------------------------------

function readCompressorName(box) {
    const len = box[50];

    // Sentinel or empty
    if (len === 0 || len === 0x80) return "";

    return new TextDecoder().decode(
        box.slice(51, 51 + len)
    );
}
