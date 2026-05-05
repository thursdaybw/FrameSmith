import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { asIsoBoxContainer } from "../box-model/Box.js";

import {
    readUint32,
} from "../bytes/mp4ByteReader.js";

import { readFourCC } from "../box-schema/boxLayoutReaders.js";

import {
    assertEqual,
    assertEqualHex,
    assertExists
} from "./assertions.js";

import { extractBoxByPathFromMp4 } from "./reference/BoxExtractor.js";

import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
import { GoldenTruthRegistry } from "./goldenTruthExtractors/GoldenTruthRegistry.js";

/**
 * =========================================================
 * MOOV — Structural Correctness (Phase A)
 * =========================================================
 *
 * This test validates that assembleMoov():
 *   - produces a MOOV container node
 *   - declares the correct children
 *   - preserves child ordering
 *
 * It does NOT validate:
 *   - sizes
 *   - offsets
 *   - byte-level equivalence
 */
export async function testMoov_Structure() {

    // ---------------------------------------------------------
    // 1. Load oracle MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Resolve MOOV via golden truth
    // ---------------------------------------------------------
    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov"
        );

    assertEqual(
        "moov box type",
        truth.readBoxReport().box.type,
        "moov"
    );

    // ---------------------------------------------------------
    // 3. Builder input from oracle
    // ---------------------------------------------------------
    const input = truth.getEmitterInput();

    assertExists("builder input", input);
    assertExists("mvhd", input.mvhd);
    assertExists("traks", input.traks);

    // ---------------------------------------------------------
    // 4. Assemble MOOV
    // ---------------------------------------------------------
    const node =
        EmitterRegistry.assemble(
            "moov",
            input
        );

    // ---------------------------------------------------------
    // 5. Structural assertions (MOOV only)
    // ---------------------------------------------------------
    assertEqual("moov.type", node.type, "moov");

    assertExists("moov.children", node.children);

    const childTypes = node.children.map(c => c.type);

    assertEqual(
        "moov.childCount",
        childTypes.length,
        input.traks.length + 1 + (input.udta ? 1 : 0)
    );

    // mvhd must be first
    assertEqual(
        "moov.child[0]",
        childTypes[0],
        "mvhd"
    );

    // trak(s) must follow
    for (let i = 0; i < input.traks.length; i++) {
        assertEqual(
            `moov.trak[${i}]`,
            childTypes[1 + i],
            "trak"
        );
    }

    // udta, if present, must be last
    if (input.udta) {
        assertEqual(
            "moov.udta",
            childTypes[childTypes.length - 1],
            "udta"
        );
    }
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

    // -----------------------------------------------------
    // 1. Load golden MP4
    // -----------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // -----------------------------------------------------
    // 2. Reference MOOV (full MP4 traversal)
    // -----------------------------------------------------
    const refBox = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(mp4, "moov");

    const refFields = refBox.readBoxReport();

    const refMoovBytes = refFields.raw;
    assertExists("reference moov raw", refMoovBytes);

    // -----------------------------------------------------
    // 3. Build MOOV from semantic intent
    // -----------------------------------------------------
    const moovInput = refBox.getEmitterInput();

    const outMoovBytes = serializeBoxTree(
        EmitterRegistry.assemble(
            "moov",
            moovInput
        )
    );

    assertExists("output moov raw", outMoovBytes);

    // -----------------------------------------------------
    // 4. Output MOOV (box-rooted traversal)
    // -----------------------------------------------------
    const outFields = GoldenTruthRegistry.getExtractor("moov").readBoxReport(outMoovBytes);

    // -----------------------------------------------------
    // 5. Header sanity
    // -----------------------------------------------------
    assertEqual(
        "moov.type",
        readFourCC(outMoovBytes, 4),
        "moov"
    );

    // -----------------------------------------------------
    // 6. Child discovery (type + offset)
    // -----------------------------------------------------
    const refContainer = asIsoBoxContainer(
        refMoovBytes,
        "moov"
    );
    const outContainer = asIsoBoxContainer(
        outMoovBytes,
        "moov"
    );

    const refChildren = refContainer.enumerateChildren();
    const outChildren = outContainer.enumerateChildren();

    assertEqual(
        "moov.child.count",
        outChildren.length,
        refChildren.length
    );

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
    // 7. Child byte-for-byte equivalence
    // -----------------------------------------------------
    for (let i = 0; i < refChildren.length; i++) {

        const refChild = refMoovBytes.slice(
            refChildren[i].offset,
            refChildren[i].offset + refChildren[i].size
        );

        const outChild = outMoovBytes.slice(
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
    // 8. Derived fields
    // -----------------------------------------------------
    assertEqual(
        "moov.size.field",
        readUint32(outMoovBytes, 0),
        readUint32(refMoovBytes, 0)
    );

    assertEqual(
        "moov.total.length",
        outMoovBytes.length,
        refMoovBytes.length
    );

    // -----------------------------------------------------
    // 9. Final full-box equivalence
    // -----------------------------------------------------
    for (let i = 0; i < refMoovBytes.length; i++) {
        assertEqualHex(
            `moov.byte[${i}]`,
            outMoovBytes[i],
            refMoovBytes[i]
        );
    }
}

export async function testMoov_LockedLayoutEquivalence_ffmpeg_Audio() {

    // -----------------------------------------------------
    // 1. Load golden MP4 (audio + video)
    // -----------------------------------------------------
    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // -----------------------------------------------------
    // 2. Reference MOOV (full MP4 traversal)
    // -----------------------------------------------------
    const refBox = getGoldenTruthBox
        .getSemanticBoxDataByPathFromMp4File(mp4, "moov");

    const refFields = refBox.readBoxReport();

    const refMoovBytes = refFields.raw;
    assertExists("reference moov raw (audio)", refMoovBytes);

    // -----------------------------------------------------
    // 3. Build MOOV from semantic intent
    // -----------------------------------------------------
    const moovInput = refBox.getEmitterInput();

    const outMoovBytes = serializeBoxTree(
        EmitterRegistry.assemble(
            "moov",
            moovInput
        )
    );

    assertExists("output moov raw (audio)", outMoovBytes);

    // -----------------------------------------------------
    // 4. Output MOOV (box-rooted traversal)
    // -----------------------------------------------------
    const outFields = GoldenTruthRegistry.getExtractor("moov").readBoxReport(outMoovBytes);

    // -----------------------------------------------------
    // 5. Header sanity
    // -----------------------------------------------------
    assertEqual(
        "moov.type",
        readFourCC(outMoovBytes, 4),
        "moov"
    );

    // -----------------------------------------------------
    // 6. Child discovery (type + offset)
    // -----------------------------------------------------
    const refContainer = asIsoBoxContainer(
        refMoovBytes,
        "moov"
    );
    const outContainer = asIsoBoxContainer(
        outMoovBytes,
        "moov"
    );

    const refChildren = refContainer.enumerateChildren();
    const outChildren = outContainer.enumerateChildren();

    assertEqual(
        "moov.child.count",
        outChildren.length,
        refChildren.length
    );

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
    // 7. Child byte-for-byte equivalence
    // -----------------------------------------------------
    for (let i = 0; i < refChildren.length; i++) {

        const refChild = refMoovBytes.slice(
            refChildren[i].offset,
            refChildren[i].offset + refChildren[i].size
        );

        const outChild = outMoovBytes.slice(
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
    // 8. Derived fields
    // -----------------------------------------------------
    assertEqual(
        "moov.size.field",
        readUint32(outMoovBytes, 0),
        readUint32(refMoovBytes, 0)
    );

    assertEqual(
        "moov.total.length",
        outMoovBytes.length,
        refMoovBytes.length
    );

    // -----------------------------------------------------
    // 9. Final full-box equivalence
    // -----------------------------------------------------
    for (let i = 0; i < refMoovBytes.length; i++) {
        assertEqualHex(
            `moov.byte[${i}]`,
            outMoovBytes[i],
            refMoovBytes[i]
        );
    }
}
