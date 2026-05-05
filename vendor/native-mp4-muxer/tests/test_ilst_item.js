import { serializeBoxTree } from "../serializer/serializeBoxTree.js";

import {
    assertEqual,
    assertEqualHex,
    assertExists
} from "./assertions.js";

import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

import {
    extractIlstItemByKeyFromMp4,
    extractBoxByPathFromMp4
} from "./reference/BoxExtractor.js";

import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";

export function testIlstItem_Structure() {

    const intent = {
        type: "©too",
        data: {
            version: 0,
            flags: 0,
            dataType: 1,
            locale: 0,
            payload: Uint8Array.from([0x66, 0x6f, 0x6f]) // "foo"
        }
    };

    const node =
        EmitterRegistry.assemble(
            "moov/udta/meta/ilst/{atom}",
            intent
        );
    // ---------------------------------------------------------
    // Box identity
    // ---------------------------------------------------------
    assertEqual("ilst item.type", node.type, "©too");

    // ---------------------------------------------------------
    // Children
    // ---------------------------------------------------------
    assertExists("ilst item.children", node.children);
    assertEqual("ilst item.children.length", node.children.length, 1);

    const child = node.children[0];

    assertEqual("ilst item child.type", child.type, "data");
}

export async function testIlstItem_LockedLayoutEquivalence_ffmpeg() {

    // ---------------------------------------------------------
    // 1. Load golden MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Extract golden truth directly (no structural walking)
    // ---------------------------------------------------------
    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/udta/meta/ilst/©too"
        );

    const refReport = truth.readBoxReport();
    const params    = truth.getEmitterInput();

    // Authoritative reference bytes
    const refRaw = refReport.raw;

    // ---------------------------------------------------------
    // 3. Rebuild ilst item exclusively from semantic params
    // ---------------------------------------------------------
    const outItem = serializeBoxTree(
        EmitterRegistry.assemble(
            "moov/udta/meta/ilst/{atom}",
            params
        )
    );

    // ---------------------------------------------------------
    // 4. Byte-for-byte locked-layout equivalence
    // ---------------------------------------------------------
    for (let i = 0; i < refRaw.length; i++) {
        assertEqualHex(
            `ilstItem.byte[${i}]`,
            outItem[i],
            refRaw[i]
        );
    }

    assertEqual(
        "ilstItem.size",
        outItem.length,
        refRaw.length
    );
}
