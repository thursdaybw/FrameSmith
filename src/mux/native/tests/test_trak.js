import {
    findBoxesByPathFromMp4,
    extractChildBoxFromContainer,
} from "./reference/BoxExtractor.js";

import {
    assertExists,
    assertEqual,
    assertEqualHex,
} from "./assertions.js";

import { asIsoBoxContainer } from "../box-model/Box.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";

export async function testTrak_Structure() {

    // ---------------------------------------------------------
    // 1. Load oracle MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Resolve TRAK via golden truth
    // ---------------------------------------------------------
    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]"
        );

    assertEqual(
        "trak box type",
        truth.readBoxReport().box.type,
        "trak"
    );

    // ---------------------------------------------------------
    // 3. Builder input from oracle
    // ---------------------------------------------------------
    const input = truth.getEmitterInput();

    assertExists("builder input", input);
    assertExists("tkhd", input.tkhd);
    assertExists("mdia", input.mdia);

    // ---------------------------------------------------------
    // 4. Assemble TRAK
    // ---------------------------------------------------------
    const node =
        EmitterRegistry.assemble(
            "moov/trak",
            input
        );

    // ---------------------------------------------------------
    // 5. Structural assertions (TRAK only)
    // ---------------------------------------------------------
    assertExists("trak.children", node.children);

    const childTypes = node.children.map(c => c.type);

    assertEqual(
        "trak.childCount",
        childTypes.length,
        3
    );

    assertEqual(
        "trak.childOrder",
        childTypes.join(","),
        "tkhd,edts,mdia"
    );
}

export async function testTrak_LockedLayoutEquivalence_ffmpeg() {

    // ---------------------------------------------------------
    // 1. Load golden MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Extract reference TRAK bytes
    // ---------------------------------------------------------
    const refTrak =
        getGoldenTruthBox
        .getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]"
        )
        .readBoxReport()
        .raw;

    assertExists("reference trak", refTrak);

    // ---------------------------------------------------------
    // 3. Build TRAK via registry (semantic intent only)
    // ---------------------------------------------------------
    const params =
        getGoldenTruthBox
        .getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]"
        )
        .getEmitterInput();

    const out =
        serializeBoxTree(
            EmitterRegistry.assemble(
                "moov/trak",
                params
            )
        );

    // ---------------------------------------------------------
    // 4. Container-level comparison
    // ---------------------------------------------------------
    const refContainer =
        asIsoBoxContainer(
            refTrak,
            "moov/trak"
        );

    const outContainer =
        asIsoBoxContainer(
            out,
            "moov/trak"
        );

    const refChildren = refContainer.enumerateChildren();
    const outChildren = outContainer.enumerateChildren();

    assertEqual(
        "trak.childCount",
        outChildren.length,
        refChildren.length
    );

    // ---------------------------------------------------------
    // 5. Child-by-child byte equivalence
    // ---------------------------------------------------------
    for (let i = 0; i < refChildren.length; i++) {

        const refChild = refChildren[i];
        const outChild = outChildren[i];

        assertEqual(
            `trak.child[${i}].type`,
            outChild.type,
            refChild.type
        );

        const refBytes =
            refTrak.slice(
                refChild.offset,
                refChild.offset + refChild.size
            );

        const outBytes =
            out.slice(
                outChild.offset,
                outChild.offset + outChild.size
            );

        assertEqual(
            `trak.${refChild.type}.size`,
            outBytes.length,
            refBytes.length
        );

        for (let j = 0; j < refBytes.length; j++) {
            assertEqualHex(
                `trak.${refChild.type}.byte[${j}]`,
                outBytes[j],
                refBytes[j]
            );
        }
    }
}

export async function testTrak_LockedLayoutEquivalence_ffmpeg_Audio() {

    const resp = await fetch("reference/reference_av.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const refTrak =
        getGoldenTruthBox
        .getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[1]"
        )
        .readBoxReport()
        .raw;

    assertExists("reference trak (audio)", refTrak);

    const params =
        getGoldenTruthBox
        .getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[1]"
        )
        .getEmitterInput();

    const out =
        serializeBoxTree(
            EmitterRegistry.assemble(
                "moov/trak",
                params
            )
        );

    const refContainer =
        asIsoBoxContainer(refTrak, "moov/trak");

    const outContainer =
        asIsoBoxContainer(out, "moov/trak");

    const refChildren = refContainer.enumerateChildren();
    const outChildren = outContainer.enumerateChildren();

    assertEqual(
        "trak.childCount",
        outChildren.length,
        refChildren.length
    );

    for (let i = 0; i < refChildren.length; i++) {

        const refChild = refChildren[i];
        const outChild = outChildren[i];

        assertEqual(
            `trak.child[${i}].type`,
            outChild.type,
            refChild.type
        );

        const refBytes =
            refTrak.slice(
                refChild.offset,
                refChild.offset + refChild.size
            );

        const outBytes =
            out.slice(
                outChild.offset,
                outChild.offset + outChild.size
            );

        assertEqual(
            `trak.${refChild.type}.size`,
            outBytes.length,
            refBytes.length
        );

        for (let j = 0; j < refBytes.length; j++) {
            assertEqualHex(
                `trak.${refChild.type}.byte[${j}]`,
                outBytes[j],
                refBytes[j]
            );
        }
    }
}
