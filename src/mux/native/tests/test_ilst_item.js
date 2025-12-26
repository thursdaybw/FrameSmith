import { emitIlstItemBox } from "../box-emitters/ilstItemBox.js";
import { emitDataBox } from "../box-emitters/dataBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";

import {
    assertEqual,
    assertEqualHex,
    assertExists
} from "./assertions.js";

import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

import {
    extractIlstItemByKeyFromMp4
} from "./reference/BoxExtractor.js";

export function testIlstItem_Structure() {

    console.log("=== testIlstItem_Structure ===");

    // ---------------------------------------------------------
    // 1. Build DATA child explicitly
    // ---------------------------------------------------------
    const data = emitDataBox({
        version: 0,
        flags: 1,
        dataType: 1,
        locale: 0,
        payload: new Uint8Array([0x01, 0x02, 0x03])
    });

    // ---------------------------------------------------------
    // 2. Build ilst item box
    // ---------------------------------------------------------
    const type = "©too";

    const node = emitIlstItemBox({
        type,
        data
    });

    // ---------------------------------------------------------
    // 3. Structural assertions
    // ---------------------------------------------------------
    assertEqual("ilstItem.type", node.type, type);

    assertExists("ilstItem.children", node.children);
    assertEqual("ilstItem.children.length", node.children.length, 1);

    assertEqual(
        "ilstItem.children[0].type",
        node.children[0].type,
        "data"
    );

    // ---------------------------------------------------------
    // 4. Serialization sanity check
    // ---------------------------------------------------------
    const out = serializeBoxTree(node);
    assertExists("serialized ilst item box", out);

    console.log("PASS: ilst item structural correctness");
}

export async function testIlstItem_LockedLayoutEquivalence_ffmpeg() {

    console.log("=== testIlstItem_LockedLayoutEquivalence_ffmpeg ===");

    // ---------------------------------------------------------
    // 1. Load golden MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Extract reference ilst *item* bytes (explicit helper)
    // ---------------------------------------------------------
    const refItemBytes = extractIlstItemByKeyFromMp4(
        mp4,
        "moov/udta/meta/ilst",
        "©too" // explicit, deterministic key
    );

    assertExists("reference ilst item", refItemBytes);

    // ---------------------------------------------------------
    // 3. Read golden truth from isolated item
    // ---------------------------------------------------------
    const truth = getGoldenTruthBox.fromBox(
        refItemBytes,
        "moov/udta/meta/ilst/*"
    );

    const refFields = truth.readFields();
    const params    = truth.getBuilderInput();

    // ---------------------------------------------------------
    // 4. Rebuild ilst item exclusively from golden truth
    // ---------------------------------------------------------
    const outItem = serializeBoxTree(
        emitIlstItemBox(params)
    );

    // ---------------------------------------------------------
    // 5. Byte-for-byte equivalence
    // ---------------------------------------------------------
    const refRaw = refFields.raw;

    for (let i = 0; i < refRaw.length; i++) {
        assertEqualHex(
            `ilstItem.byte[${i}]`,
            outItem[i],
            refRaw[i]
        );
    }

    assertEqual("ilstItem.size", outItem.length, refRaw.length);

    console.log("PASS: ilst item matches golden MP4 byte-for-byte");
}
