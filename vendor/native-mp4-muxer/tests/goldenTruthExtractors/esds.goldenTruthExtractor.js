/**
 * ESDS — Elementary Stream Descriptor Box
 * ======================================
 *
 * Golden truth extractor for ESDS.
 *
 * ESDS is a codec-owned configuration box defined by ISO/IEC 14496-1.
 * The MP4 container does not interpret its contents.
 *
 * Framesmith policy:
 * ------------------
 * ESDS payload is treated as opaque codec configuration.
 *
 * This extractor:
 * - performs no semantic parsing
 * - performs no validation beyond structure
 * - preserves bytes exactly
 *
 * Architectural parallel:
 * -----------------------
 *   avcC (video) ⇔ esds (audio)
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

function readEsdsFieldsFromBoxBytes(boxBytes) {
    if (!(boxBytes instanceof Uint8Array)) {
        throw new Error("esds.readBoxReport: expected Uint8Array");
    }

    if (readFourCC(boxBytes, 4) !== "esds") {
        throw new Error(
            "esds.readBoxReport: expected 'esds' box"
        );
    }

    const payload = getOpaquePayloadFromBytes(
        boxBytes,
        "moov/trak/mdia/minf/stbl/stsd|mp4a/esds"
    );

    const header = readBoxHeaderFromBytes(
        boxBytes,
        "moov/trak/mdia/minf/stbl/stsd|mp4a/esds"
    );

    return {
        raw: boxBytes,

        box: {
            type: "esds",
            header: header, 
            fields: {
                /**
                 * Expose the payload as a plain array of numbers.
                 *
                 * We intentionally do NOT return the Uint8Array here:
                 * - it would be a live view into the original buffer
                 * - it could be mutated by accident
                 * - it is awkward to inspect and compare in tests
                 *
                 * A plain array is a safe, snapshot representation of
                 * what was actually in the box at read time.
                 *
                 * The builder gets the real Uint8Array again later.
                 */
                opaquePayloadBytes: Array.from(payload)
            }
        },

        derived: {}
    };
}

// ---------------------------------------------------------------------------
// Builder input
// ---------------------------------------------------------------------------

function getEsdsBuilderInputFromBoxBytes(boxBytes) {

    const read = readEsdsFieldsFromBoxBytes(boxBytes);

    return {
        esds: getOpaquePayloadFromBytes(
            boxBytes,
            "moov/trak/mdia/minf/stbl/stsd|mp4a/esds"
        )
    };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerEsdsGoldenTruthExtractor(register) {
    register.readBoxReport(readEsdsFieldsFromBoxBytes);
    register.getEmitterInput(getEsdsBuilderInputFromBoxBytes);
}
