import { extractSemanticAccessUnitsFromMp4 } from "./reference/extractSemanticAccessUnitsFromMp4.js";
import { deriveChunkModel } from "../derivers/deriveChunkModel.js";
import { assembleMdatPayloadFromChunks } from "../assembleMdatPayloadFromChunks.js";
import { resolvePhysicalLayout } from "../resolvePhysicalLayout.js";

import { emitFtypBox } from "../box-emitters/ftypBox.js";
import { emitMoovBox } from "../box-emitters/moovBox.js";
import { emitMvhdBox } from "../box-emitters/mvhdBox.js";
import { emitTrakBox } from "../box-emitters/trakBox.js";

import { serializeBoxTree } from "../serializer/serializeBoxTree.js";

import { ChunkingStrategies } from "../derivers/strategies/chunkingStrategies.js";

import { assertEqual } from "./assertions.js";

import { extractAccessUnitPayloadsFromMp4 }
    from "./reference/extractAccessUnitPayloadsFromMp4.js";

export async function testNativeMuxer_PhysicalLayoutResolution_Minimal_SingleChunk_Stco() {

    console.log(
        "=== testNativeMuxer_PhysicalLayoutResolution_Minimal_SingleChunk_Stco ==="
    );

    // ---------------------------------------------------------
    // 1. Load golden MP4 (reference oracle only)
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Extract semantic samples (REFERENCE → MEANING)
    // ---------------------------------------------------------
    const samples = extractSemanticAccessUnitsFromMp4({
        mp4Bytes: mp4
    });

    const accessUnitPayloads = extractAccessUnitPayloadsFromMp4({
        mp4Bytes: mp4
    });

    // ---------------------------------------------------------
    // 3. Derive chunk model (semantic grouping)
    // ---------------------------------------------------------
    const chunks = deriveChunkModel(
        samples,
        ChunkingStrategies.ALL_SAMPLES_ONE_CHUNK
    );

    // ---------------------------------------------------------
    // 4. Assemble MDAT payload (relative offsets only)
    // ---------------------------------------------------------
    const {
        payload: mdatPayload,
        chunkOffsets
    } = assembleMdatPayloadFromChunks({
        accessUnitGroups: chunks,
        accessUnitPayloads
    });

    // ---------------------------------------------------------
    // 5. Build minimal valid box graph (size accounting only)
    // ---------------------------------------------------------

    // ---------------------------------------------------------
    // 5a. Build FTYP box (size accounting only)
    // ---------------------------------------------------------
    const ftypNode = emitFtypBox({
        majorBrand: "isom",
        minorVersion: 512,
        compatibleBrands: ["isom", "iso2", "avc1", "mp41"]
    });

    const mvhdNode = emitMvhdBox({
        timescale: 1000,
        duration: 0,
        nextTrackId: 1
    });

    // Minimal trak children (structure-only)
    const tkhdNode = { type: "tkhd", body: [] };
    const mdiaNode = { type: "mdia", body: [] };

    const trakNode = emitTrakBox({
        tkhd: tkhdNode,
        mdia: mdiaNode
    });

    const moovNode = emitMoovBox({
        mvhd: mvhdNode,
        traks: [trakNode]
    });

    // ---------------------------------------------------------
    // 6. Resolve physical layout (PASS 3)
    // ---------------------------------------------------------
    const layout = resolvePhysicalLayout({
        ftypNode,
        moovNode,
        mdatPayload,
        chunkOffsets
    });

    // ---------------------------------------------------------
    // 7. File-level box ordering
    // ---------------------------------------------------------
    assertEqual(
        "layout.fileBoxOrder",
        layout.fileBoxOrder.join(","),
        "ftyp,free,mdat,moov"
    );

    // ---------------------------------------------------------
    // 8. Chunk offset addressing decision
    // ---------------------------------------------------------
    assertEqual(
        "layout.chunkOffsetType",
        layout.chunkOffsetType,
        "stco"
    );

    // ---------------------------------------------------------
    // 9. Serialized size accounting
    // ---------------------------------------------------------
    const ftypBytes = serializeBoxTree(ftypNode);
    const moovBytes = serializeBoxTree(moovNode);

    const FREE_BOX_SIZE = 8;

    assertEqual(
        "ftyp.offset",
        layout.boxOffsets.ftyp,
        0
    );

    assertEqual(
        "free.offset",
        layout.boxOffsets.free,
        ftypBytes.length
    );

    assertEqual(
        "mdat.offset",
        layout.boxOffsets.mdat,
        ftypBytes.length + FREE_BOX_SIZE
    );

    assertEqual(
        "moov.offset",
        layout.boxOffsets.moov,
        ftypBytes.length + FREE_BOX_SIZE + 8 + mdatPayload.length
    );

    // ---------------------------------------------------------
    // 10. MDAT header sizing (derived consequence)
    // ---------------------------------------------------------
    assertEqual(
        "layout.mdatHeaderSize",
        layout.mdatHeaderSize,
        8
    );

    assertEqual(
        "mdat.dataOffset",
        layout.mdatDataOffset,
        layout.boxOffsets.mdat + layout.mdatHeaderSize
    );

    // ---------------------------------------------------------
    // 11. Chunk offset table finalization (stco)
    // ---------------------------------------------------------
    for (let i = 0; i < chunkOffsets.length; i++) {
        assertEqual(
            `stco[${i}]`,
            layout.stcoOffsets[i],
            layout.mdatDataOffset + chunkOffsets[i]
        );
    }

    assertEqual(
        "stco.count",
        layout.stcoOffsets.length,
        chunkOffsets.length
    );

    assertEqual(
        "stco.offsets.monotonic",
        layout.stcoOffsets.every((v, i, a) => i === 0 || v > a[i - 1]),
        true
    );

    console.log(
        "PASS: physical layout resolution (single chunk, stco)"
    );
}
