import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { asContainer } from "../box-model/Box.js";

import {
    readUint32,
    readFourCC
} from "../bytes/mp4ByteReader.js";

import {
    assertEqual,
    assertEqualHex,
    assertExists
} from "./assertions.js";

import { extractBoxByPathFromMp4 } from "./reference/BoxExtractor.js";

import { emitMoovBox } from "../box-emitters/moovBox.js";
import { emitMvhdBox } from "../box-emitters/mvhdBox.js";
import { emitTrakBox } from "../box-emitters/trakBox.js";
import { emitUdtaBox } from "../box-emitters/udtaBox.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

/**
 * =========================================================
 * MOOV — Structural Correctness (Phase A)
 * =========================================================
 *
 * This test validates that emitMoovBox():
 *   - emits a valid MP4 container
 *   - declares the correct children
 *   - preserves child ordering
 *
 * It does NOT validate:
 *   - sizes
 *   - offsets
 *   - byte-level equivalence
 */
export function testMoov_Structure() {

    console.log("=== testMoov_Structure ===");

    const mvhd = emitMvhdBox({
        timescale: 1000,
        duration: 0,
        nextTrackId: 1
    });

    const tkhd = { type: "tkhd", body: [] };
    const mdia = { type: "mdia", body: [] };

    const trak = emitTrakBox({
        tkhd,
        mdia
    });

    const udta = emitUdtaBox({
        children: []
    });

    const node = emitMoovBox({
        mvhd,
        traks: [trak],
        udta
    });

    const bytes = serializeBoxTree(node);

    // -----------------------------------------------------
    // Box header
    // -----------------------------------------------------
    assertEqual("moov.type", readFourCC(bytes, 4), "moov");

    // -----------------------------------------------------
    // Child discovery (structure only)
    // -----------------------------------------------------
    const container = asContainer(bytes);
    const children  = container.enumerateChildren();

    assertEqual("moov.child.count", children.length, 3);

    assertEqual("moov.child[0].type", children[0].type, "mvhd");
    assertEqual("moov.child[1].type", children[1].type, "trak");
    assertEqual("moov.child[2].type", children[2].type, "udta");

    console.log("PASS: MOOV structural correctness");
}


/**
 * =========================================================
 * MOOV — Locked Layout Equivalence (ffmpeg)
 * =========================================================
 *
 * Rules:
 * ------
 * - Field-level assertions come FIRST
 * - Full byte-for-byte comparison is LAST
 * - If the final assertion fails, earlier assertions are insufficient
 *
 * Purpose:
 * --------
 * Prove that, given identical child boxes, emitMoovBox()
 * serializes to identical bytes as ffmpeg.
 */
export async function testMoov_LockedLayoutEquivalence_ffmpeg() {

    console.log("=== testMoov_LockedLayoutEquivalence_ffmpeg ===");

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // -----------------------------------------------------
    // Reference extraction (ASSERTION SOURCE ONLY)
    // -----------------------------------------------------
    const refMoov = extractBoxByPathFromMp4(mp4, "moov");
    assertExists("reference moov", refMoov);

    // -----------------------------------------------------
    // Rebuild MOOV strictly from golden truth
    // -----------------------------------------------------
    const moovInput = getGoldenTruthBox
        .fromMp4(mp4, "moov")
        .getBuilderInput();

    const out = serializeBoxTree(
        emitMoovBox(moovInput)
    );

    // -----------------------------------------------------
    // Header fields (explicit, labelled)
    // -----------------------------------------------------
    assertEqual("moov.type", readFourCC(out, 4), "moov");

    // -----------------------------------------------------
    // Child discovery (TYPE + OFFSET ONLY)
    // -----------------------------------------------------
    const refContainer = asContainer(refMoov);
    const outContainer = asContainer(out);

    const refChildren = refContainer.enumerateChildren();
    const outChildren = outContainer.enumerateChildren();

    assertEqual("moov.child.count", outChildren.length, refChildren.length);

    for (let i = 0; i < refChildren.length; i++) {

        assertEqual(
            `moov.child[${i}].type`,
            outChildren[i].type,
            refChildren[i].type
        );

        assertEqual(
            `moov.child[${i}].offset`,
            outChildren[i].offset,
            refChildren[i].offset
        );
    }

    // -----------------------------------------------------
    // Child byte-for-byte equivalence (isolated)
    // -----------------------------------------------------
    for (let i = 0; i < refChildren.length; i++) {

        const refChild = refMoov.slice(
            refChildren[i].offset,
            refChildren[i].offset + refChildren[i].size
        );

        const outChild = out.slice(
            outChildren[i].offset,
            outChildren[i].offset + outChildren[i].size
        );

        assertEqual(
            `moov.child[${i}].size`,
            outChild.length,
            refChild.length
        );

        for (let b = 0; b < refChild.length; b++) {
            assertEqualHex(
                `moov.child[${i}].byte[${b}]`,
                outChild[b],
                refChild[b]
            );
        }
    }

    // -----------------------------------------------------
    // Derived fields (LAST)
    // -----------------------------------------------------
    assertEqual(
        "moov.size.field",
        readUint32(out, 0),
        readUint32(refMoov, 0)
    );

    assertEqual(
        "moov.total.length",
        out.length,
        refMoov.length
    );

    // -----------------------------------------------------
    // FINAL SAFETY NET — full box comparison
    // -----------------------------------------------------
    for (let i = 0; i < refMoov.length; i++) {
        assertEqualHex(
            `moov.byte[${i}]`,
            out[i],
            refMoov[i]
        );
    }

    console.log("PASS: MOOV locked-layout equivalence with ffmpeg");
}
