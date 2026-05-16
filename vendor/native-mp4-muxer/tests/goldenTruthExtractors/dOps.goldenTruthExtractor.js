/**
 * dOps — Opus Decoder Configuration Box
 * ====================================
 *
 * Golden truth extractor for dOps.
 *
 * dOps is a codec-owned configuration box defined by RFC 7845.
 * The MP4 container does not interpret its contents.
 *
 * Framesmith policy:
 * ------------------
 * dOps payload is treated as opaque codec configuration.
 *
 * This extractor:
 * - performs no semantic parsing
 * - performs no validation beyond structure
 * - preserves bytes exactly
 *
 * Architectural parallel:
 * -----------------------
 *   avcC (video) ⇔ esds (AAC audio) ⇔ dOps (Opus audio)
 */

import { readFourCC } from "../../box-schema/boxLayoutReaders.js";

import {
    getOpaquePayloadFromBytes
} from "../../box-schema/boxLayoutReaders.js";

import {
    readBoxHeaderFromBytes
} from "../../box-schema/boxLayoutReaders.js";

// ---------------------------------------------------------------------------
// Structural read
// ---------------------------------------------------------------------------

function readDOpsFieldsFromBoxBytes(boxBytes) {
    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error("dOps.readBoxReport: expected Uint8Array");
    }

    if (readFourCC(boxBytes, 4) !== "dOps") {
        throw new Error(
            "dOps.readBoxReport: expected 'dOps' box"
        );
    }

    const payload = getOpaquePayloadFromBytes(
        boxBytes,
        "moov/trak/mdia/minf/stbl/stsd|Opus/dOps"
    );

    const header = readBoxHeaderFromBytes(
        boxBytes,
        "moov/trak/mdia/minf/stbl/stsd|Opus/dOps"
    );

    let diagnosticsCache = undefined;

    return {
        raw: boxBytes,

        box: {
            type: "dOps",
            header: header,
            fields: {
                /**
                 * Expose payload as plain array snapshot.
                 * Same rationale as esds:
                 * - immutable
                 * - safe for tests
                 * - byte-for-byte comparable
                 */
                opaquePayloadBytes: Array.from(payload)
            }
        },

        derived: {},

        get diagnostics() {
            if (diagnosticsCache === undefined) {
                diagnosticsCache = decodeDOpsPayload_Compact7("dOps", boxBytes);
            }
            return diagnosticsCache;
        }
    };
}

// ---------------------------------------------------------------------------
// Builder input
// ---------------------------------------------------------------------------
function getDOpsBuilderInputFromBoxBytes(boxBytes) {

    const read = readDOpsFieldsFromBoxBytes(boxBytes);

    return {
        payload: getOpaquePayloadFromBytes(
            boxBytes,
            "moov/trak/mdia/minf/stbl/stsd|Opus/dOps"
        ),
        version: read.box.header.version,
        flags: read.box.header.flags
    };
}

function decodeDOpsPayload_Compact7(label, boxBytes) {
    const size =
        (boxBytes[0] << 24) |
        (boxBytes[1] << 16) |
        (boxBytes[2] << 8)  |
        boxBytes[3];

    const payloadOffset = 12;
    const payloadLength = size - payloadOffset;

    if (payloadLength !== 7) {
        throw new Error(
            `decodeDOpsPayload_Compact7: expected 7-byte payload, got ${payloadLength}`
        );
    }

    const p = boxBytes;

    return [
        {
            label,
            bytes: "0",
            field: "opusVersion",
            value: p[payloadOffset + 0],
        },
        {
            label,
            bytes: "1",
            field: "channelCount",
            value: p[payloadOffset + 1],
        },
        {
            label,
            bytes: "2–3",
            field: "preSkip (uint16 BE)",
            value:
            (p[payloadOffset + 2] << 8) |
            p[payloadOffset + 3],
        },
        {
            label,
            bytes: "4–6",
            field: "inputSampleRate (uint24 BE)",
            value:
            (p[payloadOffset + 4] << 16) |
            (p[payloadOffset + 5] << 8)  |
            p[payloadOffset + 6],
        },
    ];
}


// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerDOpsGoldenTruthExtractor(register) {
    register.readBoxReport(readDOpsFieldsFromBoxBytes);
    register.getEmitterInput(getDOpsBuilderInputFromBoxBytes);
}
