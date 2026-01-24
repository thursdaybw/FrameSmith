import { extractSemanticAccessUnitsFromMp4 } from "./reference/extractSemanticAccessUnitsFromMp4.js";
import { extractAccessUnitPayloadsFromMp4 } from "./reference/extractAccessUnitPayloadsFromMp4.js";
import { deriveChunkModel } from "../derivers/deriveChunkModel.js";
import { assembleMdatPayloadFromChunks } from "../assembleMdatPayloadFromChunks.js";
import { resolvePhysicalLayout } from "../resolvePhysicalLayout.js";

/*
import { emitFtypBox } from "../box-emitters/ftypBox.js";
import { emitFreeBox } from "../box-emitters/freeBox.js";
import { emitMoovBox } from "../box-emitters/moovBox.js";
import { emitMvhdBox } from "../box-emitters/mvhdBox.js";
import { assembleTrak } from "../assemblers/assembleTrak.js";
import { emitMdatBox } from "../box-emitters/mdatBox.js";
import { emitMdiaBox } from "../box-emitters/mdiaBox.js";
import { emitStcoBox } from "../box-emitters/stcoBox.js";
import { emitStsdBox } from "../box-emitters/stsdBox.js";
import { emitStssBox } from "../box-emitters/stssBox.js";
import { emitSttsBox } from "../box-emitters/sttsBox.js";
import { emitStscBox } from "../box-emitters/stscBox.js";
import { emitStszBox } from "../box-emitters/stszBox.js";
import { emitVmhdBox } from "../box-emitters/vmhdBox.js";
import { assembleDinf } from "../assemblers/assembleDinf.js";
import { emitHdlrBox } from "../box-emitters/hdlrBox.js";
import { emitTkhdBox } from "../box-emitters/tkhdBox.js";
import { emitCttsBox } from "../box-emitters/cttsBox.js";
import { emitUdtaBox } from "../box-emitters/udtaBox.js";
import { assembleEdts } from "../assemblers/assembleEdts.js";
import { assembleStbl } from "../assemblers/assembleStbl.js";
import { assembleMinf } from "../assemblers/assembleMinf.js";
import { assembleMdia } from "../assemblers/assembleMdia.js";
*/
import { commitMoovWithResolvedLayout } from "../commit/commitMoovWithResolvedLayout.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { ChunkingStrategies } from "../derivers/strategies/chunkingStrategies.js";
import { describeMp4Byte } from "./reference/Mp4ByteContext.js";
import { asIsoBoxContainer } from "../box-model/Box.js";
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

    throw new Error(
        "BLOCKED: Linker test requires extracted Phase 2 compiler output. " +
        "Re-enable once structural materialization is a standalone phase."
    );

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
            .fromMp4(
                goldenMp4,
                "moov/trak[0]/mdia/minf/stbl/stsd",
                {
                    trackType: "video",
                }
            )
        .getEmitterInput(),

        timing: {
            stts: getGoldenTruthBox
            .fromMp4(
                goldenMp4,
                "moov/trak[0]/mdia/minf/stbl/stts",
                {
                    trackType: "video",
                }
            )
            .getEmitterInput(),
            ctts: getGoldenTruthBox
            .fromMp4(
                goldenMp4,
                "moov/trak[0]/mdia/minf/stbl/ctts",
                {
                    trackType: "video",
                }
            )
            .getEmitterInput(),
            stss: getGoldenTruthBox
            .fromMp4(
                goldenMp4,
                "moov/trak[0]/mdia/minf/stbl/stss",
                {
                    trackType: "video",
                }
            )
            .getEmitterInput()
        },

        sizes: getGoldenTruthBox
        .fromMp4(
            goldenMp4,
            "moov/trak[0]/mdia/minf/stbl/stsz",
            {
                trackType: "video",
            }
        )
        .getEmitterInput(),

        chunking: getGoldenTruthBox
        .fromMp4(
            goldenMp4,
            "moov/trak[0]/mdia/minf/stbl/stsc",
            {
                trackType: "video",
            }
        )
        .getEmitterInput(),

        tkhd: getGoldenTruthBox
        .fromMp4(
            goldenMp4,
            "moov/trak[0]/tkhd",
            {
                trackType: "video",
            }
        )
        .getEmitterInput(),

        mdhd: getGoldenTruthBox
        .fromMp4(
            goldenMp4,
            "moov/trak[0]/mdia/mdhd",
            {
                trackType: "video",
            }
        )
        .getEmitterInput(),

        hdlr: getGoldenTruthBox
        .fromMp4(
            goldenMp4,
            "moov/trak[0]/mdia/hdlr",
            {
                trackType: "video",
            }
        )
        .getEmitterInput(),

        vmhd: getGoldenTruthBox
        .fromMp4(
            goldenMp4,
            "moov/trak[0]/mdia/minf/vmhd",
            {
                trackType: "video",
            }
        )
        .getEmitterInput(),

        dinf: getGoldenTruthBox
        .fromMp4(
            goldenMp4,
            "moov/trak[0]/mdia/minf/dinf",
            {
                trackType: "video",
            }
        )
        .getEmitterInput()
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
    // 3.5 Normalize semantic inputs for assemblers
    // ---------------------------------------------------------

    const stblSemanticInput = {
        stsd: trackSemanticInput.codec,
        stts: trackSemanticInput.timing.stts,
        ctts: trackSemanticInput.timing.ctts,
        stss: trackSemanticInput.timing.stss,
        stsc: trackSemanticInput.chunking,
        stsz: trackSemanticInput.sizes,
        stco: {
            chunkOffsets: new Array(chunkOffsets.length).fill(0)
        }
    };

    const vmhdSemanticInput = trackSemanticInput.vmhd;
    const dinfSemanticInput = trackSemanticInput.dinf;
    const mdhdSemanticInput = trackSemanticInput.mdhd;
    const hdlrSemanticInput = trackSemanticInput.hdlr;


    // ---------------------------------------------------------
    // 4. Build full structural graph (with placeholder STCO)
    // ---------------------------------------------------------
    const placeholderStco = emitStcoBox({
        chunkOffsets: new Array(chunkOffsets.length).fill(0)
    });

    const stbl = assembleStbl(stblSemanticInput);

    const edtsParams =
        getGoldenTruthBox
        .fromMp4(
            goldenMp4,
            "moov/trak[0]/edts",
            { trackType: "video" }
        )
        .getEmitterInput();

    const edts = assembleEdts(
        getGoldenTruthBox
        .fromMp4(
            goldenMp4,
            "moov/trak[0]/edts",
            { trackType: "video" }
        )
        .getEmitterInput()
    );


    const trak = assembleTrak({
        tkhd: trackSemanticInput.tkhd,
        edts,
        mdia: {
            mdhd: mdhdSemanticInput,
            hdlr: hdlrSemanticInput,
            minf: {
                mediaHeader: vmhdSemanticInput,
                dinf: dinfSemanticInput,
                stbl: stblSemanticInput
            }
        }
    });

    const moov = assembleMoov({
        mvhd: getGoldenTruthBox
        .fromMp4(
            goldenMp4,
            "moov/mvhd",
            { trackType: "video" }
        )
        .getEmitterInput(),
        traks: [trak],
        udta: getGoldenTruthBox
        .fromMp4(
            goldenMp4,
            "moov/udta",
            { trackType: "video" }
        )
        .getEmitterInput()
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
    const goldenTop = asIsoBoxContainer(goldenMp4).enumerateChildren();
    const outTop    = asIsoBoxContainer(outBytes).enumerateChildren();

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
