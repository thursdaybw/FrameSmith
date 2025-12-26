import { emitEdtsBox } from "../box-emitters/edtsBox.js";
import { emitElstBox } from "../box-emitters/elstBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import {
    extractBoxByPathFromMp4,
    extractChildBoxFromContainer,
} from "./reference/BoxExtractor.js";

import {
    assertEqual,
    assertEqualHex,
    assertExists
} from "./assertions.js";
import { asContainer } from "../box-model/Box.js";

import { readUint32, readInt32 } from "../bytes/mp4ByteReader.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

export async function testEdts_Structure() {

    console.log("=== testEdts_Structure ===");

    // ---------------------------------------------------------
    // 1. Build EDTS with an explicit child
    // ---------------------------------------------------------
    const elst = { type: "elst", body: [] };

    const node = emitEdtsBox({
        elst
    });

    const edts = serializeBoxTree(node);

    // ---------------------------------------------------------
    // 2. Structural assertions
    // ---------------------------------------------------------
    const foundElst = extractChildBoxFromContainer(edts, "elst");
    assertExists("elst", foundElst);

    // ---------------------------------------------------------
    // 3. Ordering assertion
    // ---------------------------------------------------------
    const childTypes = node.children.map(c => c.type);

    assertEqual(
        "edts.childOrder",
        childTypes.join(","),
        "elst"
    );

    console.log("PASS: EDTS structural correctness");
}

export async function testEdts_LockedLayoutEquivalence_ffmpeg() {

    console.log("=== testEdts_LockedLayoutEquivalence_ffmpeg ===");

    // ---------------------------------------------------------
    // 1. Load golden MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const goldenMp4 = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Extract reference EDTS
    // ---------------------------------------------------------
    const refEdts = extractBoxByPathFromMp4(
        goldenMp4,
        "moov/trak/edts"
    );

    assertExists("reference edts", refEdts);

    // ---------------------------------------------------------
    // 3. Read golden truth EDTS
    // ---------------------------------------------------------
    const truth = getGoldenTruthBox.fromMp4(
        goldenMp4,
        "moov/trak/edts"
    );

    const params = truth.getBuilderInput();

    // ---------------------------------------------------------
    // 4. Rebuild EDTS exclusively from golden truth
    // ---------------------------------------------------------
    const outEdts = serializeBoxTree(
        emitEdtsBox(params)
    );

    // ---------------------------------------------------------
    // 5. Child-by-child byte equivalence
    // ---------------------------------------------------------
    const refContainer = asContainer(refEdts);
    const outContainer = asContainer(outEdts);

    const refMeta = refContainer.enumerateChildren();

    for (const { type } of refMeta) {
        const refChild = extractChildBoxFromContainer(refEdts, type);
        const outChild = extractChildBoxFromContainer(outEdts, type);

        for (let i = 0; i < refChild.length; i++) {
            assertEqualHex(
                `edts.${type}.byte[${i}]`,
                outChild[i],
                refChild[i]
            );
        }

        assertEqual(
            `edts.${type}.size`,
            outChild.length,
            refChild.length
        );
    }

    // ---------------------------------------------------------
    // 6. Full EDTS byte equivalence (safety net)
    // ---------------------------------------------------------
    for (let i = 0; i < refEdts.length; i++) {
        assertEqualHex(
            `edts.byte[${i}]`,
            outEdts[i],
            refEdts[i]
        );
    }

    console.log("PASS: EDTS locked-layout equivalence with ffmpeg");
}
