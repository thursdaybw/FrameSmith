/**
 * ILST Golden Truth Extractor
 * ==========================
 *
 * Structural truth extractor for the ilst container.
 *
 * Responsibilities:
 * - acknowledge the presence of an ilst box
 * - preserve raw bytes for locked-layout comparison
 *
 * Non-responsibilities:
 * - item enumeration
 * - key interpretation
 * - data decoding
 * - semantic rebuilding
 */
import {
    extractChildBoxFromIlstItem
} from "../reference/BoxExtractor.js";

import { readUint32, readFourCC } from "../../bytes/mp4ByteReader.js";
import { getGoldenTruthBox } from "./index.js";
import { emitIlstItemBox } from "../../box-emitters/ilstItemBox.js";

function readIlstBoxFieldsFromBoxBytes(box) {
    if (!(box instanceof Uint8Array)) {
        throw new Error("ilst.readFields: expected Uint8Array");
    }

    return {
        raw: box
    };
}

function getIlstBuilderInputFromBoxBytes(box) {
    const items = [];

    let offset = 8; // skip ilst header

    while (offset + 8 <= box.length) {
        const size = readUint32(box, offset);
        const type = readFourCC(box, offset + 4);

        if (size < 8) break;

        const itemBytes = box.slice(offset, offset + size);

        // -----------------------------------------------------
        // Golden truth → ilst item emitter input
        // -----------------------------------------------------
        const truth = getGoldenTruthBox.fromBox(
            itemBytes,
            "moov/udta/meta/ilst/*"
        );

        const itemParams = truth.getBuilderInput();

        // -----------------------------------------------------
        // Direct pipe into emitter (NO modification)
        // -----------------------------------------------------
        const itemNode = emitIlstItemBox(itemParams);

        items.push(itemNode);

        offset += size;
    }

    return { items };
}

export function registerIlstGoldenTruthExtractor(register) {
    register.readFields(readIlstBoxFieldsFromBoxBytes);
    register.getBuilderInput(getIlstBuilderInputFromBoxBytes);
}
