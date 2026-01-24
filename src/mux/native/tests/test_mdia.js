import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import {
    findBoxesByPathFromMp4,
    extractChildBoxFromContainer
} from "./reference/BoxExtractor.js";
import {
    assertExists,
    assertEqual,
    assertEqualHex
} from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { asIsoBoxContainer } from "../box-model/Box.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";

/**
 * MDIA — Builder Input / Structure Test
 *
 * This test asserts:
 * - MDIA builder input is correctly derived from the oracle
 * - Assembler accepts oracle-provided intent
 * - MDIA emits required children in canonical order
 *
 * This avoids deep stubbing and scales up the tree.
 */
export async function testMdia_Structure() {

    // ---------------------------------------------------------
    // 1. Load oracle MP4
    // ---------------------------------------------------------

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Resolve MDIA via golden truth
    // ---------------------------------------------------------

    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]/mdia"
        );

    assertEqual(
        "mdia box type",
        truth.readBoxReport().box.type,
        "mdia"
    );

    // ---------------------------------------------------------
    // 3. Builder input from oracle
    // ---------------------------------------------------------

    const input = truth.getEmitterInput();

    assertExists("builder input", input);
    assertExists("mdhd", input.mdhd);
    assertExists("hdlr", input.hdlr);
    assertExists("minf", input.minf);

    // ---------------------------------------------------------
    // 4. Assemble MDIA
    // ---------------------------------------------------------

    const node =
        EmitterRegistry.assemble(
            "moov/trak/mdia",
            input
        );

    // ---------------------------------------------------------
    // 5. Structural assertions (MDIA only)
    // ---------------------------------------------------------

    assertExists("mdia.children", node.children);

    const childTypes = node.children.map(c => c.type);

    assertEqual(
        "mdia.childCount",
        childTypes.length,
        3
    );

    assertEqual(
        "mdia.childOrder",
        childTypes.join(","),
        "mdhd,hdlr,minf"
    );
}


export async function testMdia_LockedLayoutEquivalence_ffmpeg() {

    // ---------------------------------------------------------
    // 1. Load golden MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Extract reference MDIA (authoritative bytes)
    // ---------------------------------------------------------
    const refMdia =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4,
                "moov/trak[0]/mdia"
            )
            .readBoxReport()
            .raw;

    assertExists("reference mdia", refMdia);

    // ---------------------------------------------------------
    // 3. Rebuild MDIA via registry (semantic intent only)
    // ---------------------------------------------------------
    const params =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4,
                "moov/trak[0]/mdia"
            )
            .getEmitterInput();

    const out =
        serializeBoxTree(
            EmitterRegistry.assemble(
                "moov/trak/mdia",
                params
            )
        );

    // ---------------------------------------------------------
    // 4. Container-level comparison (ISO only)
    // ---------------------------------------------------------
    const refContainer =
        asIsoBoxContainer(
            refMdia,
            "moov/trak/mdia"
        );

    const outContainer =
        asIsoBoxContainer(
            out,
            "moov/trak/mdia"
        );

    const refChildren = refContainer.enumerateChildren();
    const outChildren = outContainer.enumerateChildren();

    assertEqual(
        "mdia.childCount",
        outChildren.length,
        refChildren.length
    );

    // ---------------------------------------------------------
    // 5. Child-level byte-for-byte equivalence
    // ---------------------------------------------------------
    for (let i = 0; i < refChildren.length; i++) {

        const refChild = refChildren[i];
        const outChild = outChildren[i];

        assertEqual(
            `mdia.child[${i}].type`,
            outChild.type,
            refChild.type
        );

        const refBytes =
            refMdia.slice(
                refChild.offset,
                refChild.offset + refChild.size
            );

        const outBytes =
            out.slice(
                outChild.offset,
                outChild.offset + outChild.size
            );

        assertEqual(
            `mdia.${refChild.type}.size`,
            outBytes.length,
            refBytes.length
        );

        for (let j = 0; j < refBytes.length; j++) {
            assertEqualHex(
                `mdia.${refChild.type}.byte[${j}]`,
                outBytes[j],
                refBytes[j]
            );
        }
    }
}
