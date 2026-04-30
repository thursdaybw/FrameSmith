import {
    getGoldenTruthBox
} from "../goldenTruthExtractors/index.js";

import {
    getHeaderLayoutForPath,
    getBoxSchemaForPath
} from "../../box-schema/boxSchemas.js";

import {
    readUint32,
} from "../../bytes/mp4ByteReader.js";

import {
    readFourCC
} from "../../box-schema/boxLayoutReaders.js";

import { EmitterRegistry } from "../../box-emitters/EmitterRegistry.js";

import { serializeBoxTree } from "../../serializer/serializeBoxTree.js";

function sizeOf(type) {
    switch (type) {
        case "uint8":  return 1;
        case "uint16": return 2;
        case "uint32": return 4;
        default:
            throw new Error(`Unknown field type '${type}'`);
    }
}

function looksLikeBoxHeader(bytes, offset) {
    const size = readUint32(bytes, offset);
    const type = readFourCC(bytes, offset + 4);

    // very conservative checks
    if (size < 8) return false;
    if (!/^[A-Za-z0-9 ]{4}$/.test(type)) return false;

    return true;
}

function readBoxHeaderAt(bytes, offset) {
    return {
        offset,
        size: readUint32(bytes, offset),
        type: readFourCC(bytes, offset + 4)
    };
}

export async function test_SchemaOracleAgreement_OpusSampleEntry() {

    // ---------------------------------------------------------
    // Load oracle MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_av_opus.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Extract raw Opus SampleEntry bytes
    // ---------------------------------------------------------
    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[1]/mdia/minf/stbl/stsd/sample[0]"
        );

    const raw = truth.readBoxReport().raw;

    // ---------------------------------------------------------
    // Resolve schema + header layout
    // ---------------------------------------------------------
    const path = "moov/trak/mdia/minf/stbl/stsd|Opus";

    const schema = getBoxSchemaForPath(path);
    const header = getHeaderLayoutForPath(path);

    // ---------------------------------------------------------
    // Walk schema fields exactly as declared
    // ---------------------------------------------------------
    let cursor = header.headerSize;

    for (const [name, type] of Object.entries(schema.fields)) {
        cursor += sizeOf(type);
    }

    // ---------------------------------------------------------
    // Assert fixed-field boundary
    // ---------------------------------------------------------
    if (cursor !== schema.sampleEntry.childrenOffset) {
        throw new Error(
            `[SchemaOracleAgreement][Opus] Fixed fields end at ${cursor}, ` +
            `but schema declares childrenOffset ${schema.sampleEntry.childrenOffset}`
        );
    }

    // ---------------------------------------------------------
    // Assert oracle actually contains a child box header here
    // ---------------------------------------------------------
    if (!looksLikeBoxHeader(raw, cursor)) {
        const size = readUint32(raw, cursor);
        const type = readFourCC(raw, cursor + 4);

        throw new Error(
            `[SchemaOracleAgreement][Opus] Bytes at childrenOffset ${cursor} ` +
            `do not look like a box header. ` +
            `Read size=${size}, type='${type}'`
        );
    }

    // POSITIVE ASSERTION: log the header we found
    const headerAtBoundary = readBoxHeaderAt(raw, cursor);
    console.log(
        "[SchemaOracleAgreement][Opus] Child header found at boundary:",
        headerAtBoundary
    );

    // ---------------------------------------------------------
    // Optional: assert first child is dOps (oracle expectation)
    // ---------------------------------------------------------
    const firstChildType = readFourCC(raw, cursor + 4);

    if (firstChildType !== "dOps") {
        throw new Error(
            `[SchemaOracleAgreement][Opus] Expected first child 'dOps', ` +
            `found '${firstChildType}'`
        );
    }

    // POSITIVE ASSERTION
    console.log(
        "[SchemaOracleAgreement][Opus] First child verified:",
        headerAtBoundary.type,
        `(size=${headerAtBoundary.size})`
    );

    let childOffset = cursor;

    while (childOffset < raw.length) {
        const size = readUint32(raw, childOffset);
        const type = readFourCC(raw, childOffset + 4);

        console.log("[SchemaOracleAgreement][Opus] Child verified:", {
            offset: childOffset,
            size,
            type
        });

        childOffset += size;
    }

    if (childOffset !== raw.length) {
        throw new Error(
            `[SchemaOracleAgreement][Opus] Children do not end at box boundary`
        );
    }

    // ---------------------------------------------------------
    // Byte-for-byte round-trip assertion (extract → emit)
    // ---------------------------------------------------------
    const emitterInput = truth.getEmitterInput();

    console.log("emitterInput", emitterInput);

    const node =
        EmitterRegistry.assemble(
            "moov/trak/mdia/minf/stbl/stsd|Opus",
            emitterInput
        );

    const emitted = serializeBoxTree(node);

    // ---------------------------------------------------------
    // Compare ONLY bytes that:
    // 1. are structurally proven (fixed fields)
    // 2. exist in BOTH oracle and emitted output
    // ---------------------------------------------------------
    const start = header.headerSize;
    const end   = Math.min(
        schema.sampleEntry.childrenOffset,
        emitted.length,
        raw.length
    );

    for (let i = start; i < end; i++) {
        if (emitted[i] !== raw[i]) {
            throw new Error(
                `[SchemaOracleAgreement][Opus] Fixed-field mismatch at offset ${i}: ` +
                `oracle=${raw[i]}, emitted=${emitted[i]}`
            );
        }
    }

    console.log(
        "[SchemaOracleAgreement][Opus] Fixed-field bytes round-trip verified " +
        `(${start}..${end})`
    );

    // ---------------------------------------------------------
    // Byte-for-byte comparison for CHILDREN ONLY
    // (after fixed fields have been proven)
    // ---------------------------------------------------------
    const childrenStart = schema.sampleEntry.childrenOffset;
    const childrenEnd   = Math.min(raw.length, emitted.length);

    for (let i = childrenStart; i < childrenEnd; i++) {
        if (emitted[i] !== raw[i]) {
            throw new Error(
                `[SchemaOracleAgreement][Opus] Child-byte mismatch at offset ${i}: ` +
                `oracle=${raw[i]}, emitted=${emitted[i]}`
            );
        }
    }

    // Length must match once children are emitted
    if (emitted.length !== raw.length) {
        throw new Error(
            `[SchemaOracleAgreement][Opus] Emitted length ${emitted.length} ` +
            `does not match oracle length ${raw.length}`
        );
    }

    console.log(
        "[SchemaOracleAgreement][Opus] Child bytes round-trip verified " +
        `(${childrenStart}..${childrenEnd})`
    );

    console.log(
        "[PASS][SchemaOracleAgreement][Opus] " +
        "Schema fixed fields match oracle byte layout exactly."
    );
}
