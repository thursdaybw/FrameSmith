import { extractSemanticAccessUnitsFromMp4 } from "./reference/extractSemanticAccessUnitsFromMp4.js";
import { extractAccessUnitPayloadsFromMp4 } from "./reference/extractAccessUnitPayloadsFromMp4.js";
import { deriveChunkModel } from "../derivers/deriveChunkModel.js";
import { assembleMdatPayloadFromChunks } from "../assembleMdatPayloadFromChunks.js";
import { resolvePhysicalLayout } from "../resolvePhysicalLayout.js";

import { emitFtypBox } from "../box-emitters/ftypBox.js";
import { emitFreeBox } from "../box-emitters/freeBox.js";
import { emitMoovBox } from "../box-emitters/moovBox.js";
import { emitMvhdBox } from "../box-emitters/mvhdBox.js";
import { emitTrakBox } from "../box-emitters/trakBox.js";
import { emitMdatBox } from "../box-emitters/mdatBox.js";

import { emitStblBox } from "../box-emitters/stblBox.js";
import { emitMinfBox } from "../box-emitters/minfBox.js";
import { emitMdiaBox } from "../box-emitters/mdiaBox.js";
import { emitStcoBox } from "../box-emitters/stcoBox.js";
import { emitStsdBox } from "../box-emitters/stsdBox.js";
import { emitStssBox } from "../box-emitters/stssBox.js";
import { emitSttsBox } from "../box-emitters/sttsBox.js";
import { emitStscBox } from "../box-emitters/stscBox.js";
import { emitStszBox } from "../box-emitters/stszBox.js";
import { emitVmhdBox } from "../box-emitters/vmhdBox.js";
import { emitDinfBox } from "../box-emitters/dinfBox.js";
import { emitMdhdBox } from "../box-emitters/mdhdBox.js";
import { emitHdlrBox } from "../box-emitters/hdlrBox.js";
import { emitTkhdBox } from "../box-emitters/tkhdBox.js";
import { emitCttsBox } from "../box-emitters/cttsBox.js";
import { emitUdtaBox } from "../box-emitters/udtaBox.js";
import { emitEdtsBox } from "../box-emitters/edtsBox.js";

import { commitMoovWithResolvedLayout } from "../commit/commitMoovWithResolvedLayout.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { ChunkingStrategies } from "../derivers/strategies/chunkingStrategies.js";
import { describeMp4Byte } from "./reference/Mp4ByteContext.js";
import { asContainer } from "../box-model/Box.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

import { emitMp4FileFromResolvedParts } from "../emitMp4FileFromResolvedParts.js";


/**
 * NativeMuxer linker conformance against ffmpeg.
 *
 * This test verifies the final, terminal step of MP4 production:
 * the linker.
 *
 * Contract:
 * ---------
 * Given:
 *   - fully resolved box structure
 *   - resolved physical layout (including stco offsets)
 *   - finalized media payload (mdat)
 *
 * When:
 *   - emitMp4FileFromResolvedParts is invoked
 *
 * Then:
 *   - the resulting MP4 must be byte-for-byte identical
 *     to the ffmpeg oracle.
 *
 * This test does NOT verify:
 *   - semantic derivation
 *   - container policy decisions
 *   - layout resolution
 *
 * Those responsibilities are exercised elsewhere.
 *
 * This is a HARD GATE.
 * Any failure here indicates a real regression in the linker.
 */
export async function test_NativeMuxer_Linker_EmitsResolvedMp4() {
    console.log("=== test_NativeMuxer_Linker_EmitsResolvedMp4 ===");

    // ---------------------------------------------------------
    // 1. Load golden MP4 (ffmpeg oracle)
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const goldenMp4 = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Golden semantic inputs (structure → meaning)
    // ---------------------------------------------------------
    const trackSemanticInput = {
        codec: getGoldenTruthBox
            .fromMp4(goldenMp4, "moov/trak/mdia/minf/stbl/stsd")
            .getBuilderInput(),

        timing: {
            stts: getGoldenTruthBox
                .fromMp4(goldenMp4, "moov/trak/mdia/minf/stbl/stts")
                .getBuilderInput(),
            ctts: getGoldenTruthBox
                .fromMp4(goldenMp4, "moov/trak/mdia/minf/stbl/ctts")
                .getBuilderInput(),
            stss: getGoldenTruthBox
                .fromMp4(goldenMp4, "moov/trak/mdia/minf/stbl/stss")
                .getBuilderInput()
        },

        sizes: getGoldenTruthBox
            .fromMp4(goldenMp4, "moov/trak/mdia/minf/stbl/stsz")
            .getBuilderInput(),

        chunking: getGoldenTruthBox
            .fromMp4(goldenMp4, "moov/trak/mdia/minf/stbl/stsc")
            .getBuilderInput(),

        tkhd: getGoldenTruthBox
            .fromMp4(goldenMp4, "moov/trak/tkhd")
            .getBuilderInput(),

        mdhd: getGoldenTruthBox
            .fromMp4(goldenMp4, "moov/trak/mdia/mdhd")
            .getBuilderInput(),

        hdlr: getGoldenTruthBox
            .fromMp4(goldenMp4, "moov/trak/mdia/hdlr")
            .getBuilderInput(),

        vmhd: getGoldenTruthBox
            .fromMp4(goldenMp4, "moov/trak/mdia/minf/vmhd")
            .getBuilderInput(),

        dinf: getGoldenTruthBox
            .fromMp4(goldenMp4, "moov/trak/mdia/minf/dinf")
            .getBuilderInput()
    };

    // ---------------------------------------------------------
    // 3. Semantic samples → chunks → mdat payload
    // ---------------------------------------------------------
    const samples = extractSemanticAccessUnitsFromMp4({ mp4Bytes: goldenMp4 });

    const accessUnitPayloads = extractAccessUnitPayloadsFromMp4({
        mp4Bytes: goldenMp4
    });

    const chunks = deriveChunkModel(
        samples,
        ChunkingStrategies.ALL_SAMPLES_ONE_CHUNK
    );

    const {
        payload: mdatPayload,
        chunkOffsets
    } = assembleMdatPayloadFromChunks({
        accessUnitGroups: chunks,
        accessUnitPayloads
    });

    // ---------------------------------------------------------
    // 4. Build full structural graph (with placeholder STCO)
    // ---------------------------------------------------------
    const placeholderStco = emitStcoBox({
        chunkOffsets: new Array(chunkOffsets.length).fill(0)
    });

    const stbl = emitStblBox({
        stsd: emitStsdBox(trackSemanticInput.codec),
        stts: emitSttsBox(trackSemanticInput.timing.stts),
        ctts: emitCttsBox(trackSemanticInput.timing.ctts),
        stss: emitStssBox(trackSemanticInput.timing.stss),
        stsc: emitStscBox(trackSemanticInput.chunking),
        stsz: emitStszBox(trackSemanticInput.sizes),
        stco: placeholderStco
    });

    const minf = emitMinfBox({
        vmhd: emitVmhdBox(trackSemanticInput.vmhd),
        dinf: emitDinfBox(trackSemanticInput.dinf),
        stbl
    });

    const mdia = emitMdiaBox({
        mdhd: emitMdhdBox(trackSemanticInput.mdhd),
        hdlr: emitHdlrBox(trackSemanticInput.hdlr),
        minf
    });

    const edts = emitEdtsBox(
        getGoldenTruthBox
            .fromMp4(goldenMp4, "moov/trak/edts")
            .getBuilderInput()
    );

    const trak = emitTrakBox({
        tkhd: emitTkhdBox(trackSemanticInput.tkhd),
        edts,
        mdia
    });

    const moov = emitMoovBox({
        mvhd: emitMvhdBox(
            getGoldenTruthBox
                .fromMp4(goldenMp4, "moov/mvhd")
                .getBuilderInput()
        ),
        traks: [trak],
        udta: emitUdtaBox(
            getGoldenTruthBox
                .fromMp4(goldenMp4, "moov/udta")
                .getBuilderInput()
        )
    });

    const ftyp = emitFtypBox({
        majorBrand: "isom",
        minorVersion: 512,
        compatibleBrands: ["isom", "iso2", "avc1", "mp41"]
    });

    // ---------------------------------------------------------
    // 5. Physical layout + STCO commit
    // ---------------------------------------------------------
    const layout = resolvePhysicalLayout({
        ftypNode: ftyp,
        moovNode: moov,
        mdatPayload,
        chunkOffsets
    });

    const committedMoov = commitMoovWithResolvedLayout({
        originalMoovNode: moov,
        stcoOffsets: layout.stcoOffsets
    });

    // ---------------------------------------------------------
    // 6. Final file assembly
    // ---------------------------------------------------------
    const outBytes = emitMp4FileFromResolvedParts({
        ftypNode: ftyp,
        committedMoovNode: committedMoov,
        mdatPayload,
        fileBoxOrder: layout.fileBoxOrder
    });

    // ---------------------------------------------------------
    // 7. Top-level structural parity (hard gate)
    // ---------------------------------------------------------
    const goldenTop = asContainer(goldenMp4).enumerateChildren();
    const outTop    = asContainer(outBytes).enumerateChildren();

    if (goldenTop.length !== outTop.length) {
        throw new Error(
            `TOP-LEVEL BOX COUNT MISMATCH\n` +
            `golden: ${goldenTop.map(b => b.type).join(", ")}\n` +
            `out:    ${outTop.map(b => b.type).join(", ")}`
        );
    }

    for (let i = 0; i < goldenTop.length; i++) {
        if (goldenTop[i].type !== outTop[i].type) {
            throw new Error(
                `TOP-LEVEL BOX TYPE MISMATCH @ ${i}: ` +
                `${goldenTop[i].type} vs ${outTop[i].type}`
            );
        }
        if (goldenTop[i].size !== outTop[i].size) {
            throw new Error(
                `TOP-LEVEL BOX SIZE MISMATCH (${goldenTop[i].type}): ` +
                `${goldenTop[i].size} vs ${outTop[i].size}`
            );
        }
    }

    // ---------------------------------------------------------
    // 8. Final byte-for-byte equivalence (absolute gate)
    // ---------------------------------------------------------
    for (let i = 0; i < goldenMp4.length; i++) {
        if (outBytes[i] !== goldenMp4[i]) {
            const ctx = describeMp4Byte(goldenMp4, i);
            throw new Error(
                [
                    `FAIL: mp4.byte[${i}] mismatch`,
                    `Box:     ${ctx.box}`,
                    `Section: ${ctx.section}`,
                    `Detail:  ${ctx.detail}`,
                    `Expected: 0x${goldenMp4[i].toString(16).padStart(2, "0")}`,
                    `Actual:   0x${outBytes[i].toString(16).padStart(2, "0")}`
                ].join("\n")
            );
        }
    }

    if (window.DEBUG_DOWNLOAD_MP4 === true) {
        downloadMp4(outBytes);
    }

    console.log("PASS: NativeMuxer end-to-end byte-for-byte conformance");
}


function downloadMp4(bytes, filename = "native-muxer-output.mp4") {
    const blob = new Blob([bytes], { type: "video/mp4" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
