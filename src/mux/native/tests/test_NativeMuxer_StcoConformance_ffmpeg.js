import { extractSemanticAccessUnitsFromMp4 } from "./reference/extractSemanticAccessUnitsFromMp4.js";
import { extractAccessUnitPayloadsFromMp4 }
    from "./reference/extractAccessUnitPayloadsFromMp4.js";

import { extractBoxByPathFromMp4 } from "./reference/BoxExtractor.js";

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
import { assertEqualHex } from "./assertions.js";

import { asIsoBoxContainer } from "../box-model/Box.js";
import { readUint32 } from "../bytes/mp4ByteReader.js";

export async function testNativeMuxer_StcoConformance_ffmpeg() {

    // ---------------------------------------------------------
    // 1. Load golden MP4 (ffmpeg oracle)
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const goldenLayout = inspectGoldenMp4Layout(mp4);

    // ---------------------------------------------------------
    // 2. Extract reference STCO bytes
    // ---------------------------------------------------------
    const refStco = extractBoxByPathFromMp4(
        mp4,
        "moov/trak/mdia/minf/stbl/stco"
    );

    if (!refStco) {
        throw new Error("reference STCO box not found");
    }

    const diagnostic_entryCount = readUint32(refStco, 12);

    console.log("stco.entryCount =", diagnostic_entryCount);

    for (let i = 0; i < diagnostic_entryCount; i++) {
        const offset =
            readUint32(refStco, 16 + i * 4);

        console.log(
            `stco[${i}] = ${offset}`
        );
    }

    console.log(
        "stco[0] vs mdat.dataOffset:",
        "stco[0] =", readUint32(refStco, 16),
        "mdat.dataOffset =", goldenLayout.mdatDataOffset
    );

    // ---------------------------------------------------------
    // 3. Semantic samples (oracle → meaning)
    // ---------------------------------------------------------
    const samples = extractSemanticAccessUnitsFromMp4({
        mp4Bytes: mp4
    });

    const accessUnitPayloads = extractAccessUnitPayloadsFromMp4({
        mp4Bytes: mp4
    });

    // ---------------------------------------------------------
    // 4. Chunk model (policy-aligned with fixture)
    // ---------------------------------------------------------
    const chunks = deriveChunkModel(
        samples,
        ChunkingStrategies.ALL_SAMPLES_ONE_CHUNK
    );

    // ---------------------------------------------------------
    // 5. MDAT assembly (Pass 2)
    // ---------------------------------------------------------
    const {
        payload: mdatPayload,
        chunkOffsets
    } = assembleMdatPayloadFromChunks({
        accessUnitGroups: chunks,
        accessUnitPayloads
    });

    // ---------------------------------------------------------
    // 6. Minimal valid box graph
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
    // 7. Physical layout resolution (Pass 3)
    // ---------------------------------------------------------
    const layout = resolvePhysicalLayout({
        ftypNode,
        moovNode,
        mdatPayload,
        chunkOffsets
    });

    // ---------------------------------------------------------
    // 8. Final STCO emission (commit)
    // ---------------------------------------------------------
    const outStco = serializeBoxTree(
        emitStcoBox({
            chunkOffsets: layout.stcoOffsets
        })
    );

    // ---------------------------------------------------------
    // 9. Byte-for-byte equivalence
    // ---------------------------------------------------------
    const entryCount = layout.stcoOffsets.length;

    for (let i = 0; i < refStco.length; i++) {
        const meaning = describeStcoByte(i, entryCount);

        assertEqualHex(
            `stco.byte[${i}] (${meaning})`,
            outStco[i],
            refStco[i]
        );
    }

    assertEqualHex(
        "stco.byteLength",
        outStco.length,
        refStco.length
    );

    console.log(
        "PASS: STCO byte-for-byte conformance with ffmpeg"
    );
}


function describeStcoByte(index, entryCount) {
    if (index < 4) return "box.size";
    if (index < 8) return "box.type";
    if (index === 8) return "version";
    if (index >= 9 && index <= 11) return "flags";
    if (index >= 12 && index <= 15) return "entry_count";

    const offsetIndex = index - 16;
    const entry = Math.floor(offsetIndex / 4);
    const byteInEntry = offsetIndex % 4;

    if (entry < entryCount) {
        return `chunk_offset[${entry}].byte[${byteInEntry}]`;
    }

    return "out_of_bounds";
}

function inspectGoldenMp4Layout(mp4) {
    const container = asIsoBoxContainer(mp4);
    const children  = container.enumerateChildren();

    console.log("---- GOLDEN MP4 LAYOUT ----");

    for (const child of children) {
        console.log(
            `box ${child.type} @ offset=${child.offset} size=${child.size}`
        );
    }

    const mdat = children.find(c => c.type === "mdat");
    const moov = children.find(c => c.type === "moov");
    const ftyp = children.find(c => c.type === "ftyp");

    if (!mdat) {
        throw new Error("Golden MP4: mdat not found");
    }

    const declaredSize = readUint32(mp4, mdat.offset);

    const mdatHeaderSize =
        declaredSize === 1 ? 16 : 8;

    const mdatDataOffset = mdat.offset + mdatHeaderSize;

    console.log("mdat.offset          =", mdat.offset);
    console.log("mdat.declaredSize    =", declaredSize);
    console.log("mdat.headerSize      =", mdatHeaderSize);
    console.log("mdat.dataOffset      =", mdatDataOffset);

    return {
        ftyp,
        moov,
        mdat,
        mdatHeaderSize,
        mdatDataOffset
    };
}
