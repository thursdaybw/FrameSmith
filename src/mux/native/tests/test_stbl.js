import { serializeBoxTree } from "../serializer/serializeBoxTree.js";

import { emitStblBox } from "../box-emitters/stblBox.js";
import { emitStsdBox } from "../box-emitters/stsdBox.js";
import { emitStssBox } from "../box-emitters/stssBox.js";
import { emitSttsBox } from "../box-emitters/sttsBox.js";
import { emitCttsBox } from "../box-emitters/cttsBox.js";
import { emitStscBox } from "../box-emitters/stscBox.js";
import { emitStszBox } from "../box-emitters/stszBox.js";
import { emitStcoBox } from "../box-emitters/stcoBox.js";

import { asContainer } from "../box-model/Box.js";

import {
    extractBoxByPathFromMp4,
    extractBoxByPathFromBox,
    extractChildBoxFromContainer,
} from "./reference/BoxExtractor.js";
import { } from "../bytes/mp4ByteReader.js";
import { SampleEntryReader } from "./reference/SampleEntryReader.js";
import {
    assertEqual,
    assertEqualHex,
    assertExists
} from "./assertions.js";

import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

export async function testStbl_Structure() {

    console.log("=== testStbl_Structure ===");

    // ---------------------------------------------------------
    // 1. Build explicit child boxes (already validated elsewhere)
    // ---------------------------------------------------------
    const stsd = { type: "stsd", body: [] };
    const stts = { type: "stts", body: [] };
    const stss = { type: "stss", body: [] };
    const ctts = { type: "ctts", body: [] };
    const stsc = { type: "stsc", body: [] };
    const stsz = { type: "stsz", body: [] };
    const stco = { type: "stco", body: [] };

    // ---------------------------------------------------------
    // 2. Build STBL
    // ---------------------------------------------------------
    const node = emitStblBox({
        stsd,
        stts,
        stss,
        ctts,
        stsc,
        stsz,
        stco
    });

    const stbl = serializeBoxTree(node);

    // ---------------------------------------------------------
    // 3. Structural assertions
    // ---------------------------------------------------------
    //const stbl = extractBoxByPathFromBox(buffer, ["stbl"]);

    assertExists("stsd", extractBoxByPathFromBox(stbl, "stsd"));
    assertExists("stts", extractBoxByPathFromBox(stbl, "stts"));
    assertExists("stss", extractBoxByPathFromBox(stbl, "stss"));
    assertExists("ctts", extractBoxByPathFromBox(stbl, "ctts"));
    assertExists("stsc", extractBoxByPathFromBox(stbl, "stsc"));
    assertExists("stsz", extractBoxByPathFromBox(stbl, "stsz"));
    assertExists("stco", extractBoxByPathFromBox(stbl, "stco"));

    // Optional but recommended: ordering check
    const childOrder = node.children.map(b => b.type).join(",");
    assertEqual(
        "stbl.childOrder",
        childOrder,
        "stsd,stts,stss,ctts,stsc,stsz,stco"
    );;

    console.log("PASS: STBL structural correctness");
}

export async function testStbl_LockedLayoutEquivalence_ffmpeg() {

    console.log("=== testStbl_LockedLayoutEquivalence_ffmpeg ===");

    // ---------------------------------------------------------
    // 1. Load golden MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Extract reference STBL
    // ---------------------------------------------------------
    const refStbl = extractBoxByPathFromMp4(
        mp4,
        "moov/trak/mdia/minf/stbl"
    );

    assertExists("reference STBL", refStbl);

    // ---------------------------------------------------------
    // 3. Read golden truth STBL
    // ---------------------------------------------------------
    const truth = getGoldenTruthBox.fromMp4(
        mp4,
        "moov/trak/mdia/minf/stbl"
    );

    const refFields = truth.readFields();
    const params    = truth.getBuilderInput();

    // ---------------------------------------------------------
    // 4. Rebuild STBL exclusively from golden truth
    // ---------------------------------------------------------
    const out = serializeBoxTree(
        emitStblBox(params)
    );

    // ---------------------------------------------------------
    // 5. Child-level byte-for-byte equivalence
    // ---------------------------------------------------------
    const refContainer = asContainer(refStbl);
    const outContainer = asContainer(out);

    const refMeta = refContainer.enumerateChildren();

    for (let i = 0; i < refMeta.length; i++) {
        const { type } = refMeta[i];

        const refChildBytes = extractChildBoxFromContainer(
            refStbl,
            type
        );

        const outChildBytes = extractChildBoxFromContainer(
            out,
            type
        );

        for (let j = 0; j < refChildBytes.length; j++) {
            assertEqualHex(
                `stbl.${type}.byte[${j}]`,
                outChildBytes[j],
                refChildBytes[j]
            );
        }

        assertEqual(
            `stbl.${type}.size`,
            outChildBytes.length,
            refChildBytes.length
        );

    }

    console.log("PASS: STBL matches ffmpeg byte-for-byte");
}

/**
 * STBL — Structural Conditional Children
 * -------------------------------------
 *
 * Asserts that STBL accepts conditional presence of:
 *   - stss (sync samples)
 *   - ctts (composition offsets)
 *
 * This test is structural only.
 * No semantics, no layout equivalence.
 */
export function testStbl_Structure_ConditionalChildren() {
    console.log("=== testStbl_Structure_ConditionalChildren ===");

    const base = {
        stsd: { type: "stsd", body: [] },
        stts: { type: "stts", body: [] },
        stsc: { type: "stsc", body: [] },
        stsz: { type: "stsz", body: [] },
        stco: { type: "stco", body: [] },
    };

    // Case 1: both present
    emitStblBox({
        ...base,
        stss: { type: "stss", body: [] },
        ctts: { type: "ctts", body: [] },
    });

    // Case 2: stss only
    emitStblBox({
        ...base,
        stss: { type: "stss", body: [] },
    });

    // Case 3: ctts only
    emitStblBox({
        ...base,
        ctts: { type: "ctts", body: [] },
    });

    // Case 4: neither present
    emitStblBox({
        ...base,
    });

    console.log(
        "PASS: STBL accepts conditional presence of stss / ctts"
    );
}

/**
 * STBL — Conditional Children TODO
 * --------------------------------
 *
 * This is a placeholder test.
 *
 * Purpose:
 *   - Explicitly mark unfinished work around conditional STBL children
 *     (stss, ctts) during NativeMuxer assembly.
 *
 * This test intentionally:
 *   - does not assert
 *   - does not emit boxes
 *   - does not inspect MP4s
 *   - does not encode behaviour
 *
 * If this warning still exists, the work is not done.
 */
export function testStbl_ConditionalChildren_TODO() {
    console.log("=== testStbl_Structure_ConditionalChildrenTODO ===");
    console.warn(
        "TODO: STBL conditional children (stss / ctts) handling " +
        "must be implemented during NativeMuxer assembly."
    );
}
