import { extractSemanticAccessUnitsFromMp4 } from "./reference/extractSemanticAccessUnitsFromMp4.js";
import { extractAccessUnitPayloadsFromMp4 } from "./reference/extractAccessUnitPayloadsFromMp4.js";
import { deriveChunkModel } from "../derivers/deriveChunkModel.js";
import { assembleMdatPayloadFromChunks } from "../assembleMdatPayloadFromChunks.js";
import { resolvePhysicalLayout } from "../resolvePhysicalLayout.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";

/*
import { emitStcoBox } from "../box-emitters/stcoBox.js";
import { emitFtypBox } from "../box-emitters/ftypBox.js";
import { emitMoovBox } from "../box-emitters/moovBox.js";
import { emitMvhdBox } from "../box-emitters/mvhdBox.js";
import { emitTrakBox } from "../box-emitters/trakBox.js";
*/
import { ChunkingStrategies } from "../derivers/strategies/chunkingStrategies.js";
import { readUint32 } from "../bytes/mp4ByteReader.js";
import { assertEqual } from "./assertions.js";

export async function testNativeMuxer_StcoCommit_FromPhysicalLayout() {

    console.log(
        "=== testNativeMuxer_StcoCommit_FromPhysicalLayout ==="
    );

    // ---------------------------------------------------------
    // 1. Load golden MP4 (oracle only)
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Semantic samples
    // ---------------------------------------------------------
    const samples = extractSemanticAccessUnitsFromMp4({
        mp4Bytes: mp4
    });

    const accessUnitPayloads = extractAccessUnitPayloadsFromMp4({
        mp4Bytes: mp4
    });

    // ---------------------------------------------------------
    // 3. Chunk model
    // ---------------------------------------------------------
    const chunks = deriveChunkModel(
        samples,
        ChunkingStrategies.ALL_SAMPLES_ONE_CHUNK
    );

    // ---------------------------------------------------------
    // 4. MDAT assembly (Pass 2)
    // ---------------------------------------------------------
    const {
        payload: mdatPayload,
        chunkOffsets
    } = assembleMdatPayloadFromChunks({
        accessUnitGroups: chunks,
        accessUnitPayloads
    });

    // ---------------------------------------------------------
    // 5. Minimal valid box graph
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

    const trakNode = emitTrakBox({
        tkhd: { type: "tkhd", body: [] },
        mdia: { type: "mdia", body: [] }
    });

    const moovNode = emitMoovBox({
        mvhd: mvhdNode,
        traks: [trakNode]
    });

    // ---------------------------------------------------------
    // 6. Physical layout resolution (Pass 3)
    // ---------------------------------------------------------
    const layout = resolvePhysicalLayout({
        ftypNode,
        moovNode,
        mdatPayload,
        chunkOffsets
    });

    // ---------------------------------------------------------
    // 7. Commit STCO using layout output
    // ---------------------------------------------------------
    const stcoNode = emitStcoBox({
        chunkOffsets: layout.stcoOffsets
    });

    const stcoBytes = serializeBoxTree(stcoNode);

    // ---------------------------------------------------------
    // 8. Decode STCO entries and assert equality
    // ---------------------------------------------------------
    const entryCount = readUint32(stcoBytes, 12);
    assertEqual("stco.entryCount", entryCount, layout.stcoOffsets.length);

    let cursor = 16;

    for (let i = 0; i < entryCount; i++) {
        const value = readUint32(stcoBytes, cursor);
        assertEqual(
            `stco.offset[${i}]`,
            value,
            layout.stcoOffsets[i]
        );
        cursor += 4;
    }

    console.log(
        "PASS: STCO commit reflects physical layout exactly"
    );
}
