import { emitMdiaBox } from "../box-emitters/mdiaBox.js";
import { emitMinfBox } from "../box-emitters/minfBox.js";
import { emitMdhdBox } from "../box-emitters/mdhdBox.js";
import { emitHdlrBox } from "../box-emitters/hdlrBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import {
    extractBoxByPathFromMp4,
    extractChildBoxFromContainer
} from "./reference/BoxExtractor.js";
import {
    assertExists,
    assertEqual
} from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { asContainer } from "../box-model/Box.js";

/**
 * MDIA — Structural Correctness (Phase A)
 * --------------------------------------
 *
 * Validates the structural intent of the Media Box.
 *
 * This test does NOT:
 *   - infer media type
 *   - validate timing semantics
 *   - test byte equivalence
 *
 * It asserts only what MDIA is responsible for:
 *   - container presence
 *   - required children
 *   - canonical ordering
 */
export async function testMdia_Structure() {

    console.log("=== testMdia_Structure ===");

    // ---------------------------------------------------------
    // 1. Explicit children (policy injected by test)
    // ---------------------------------------------------------
    const mdhd = { type: "mdhd", body: [] };
    const hdlr = { type: "hdlr", body: [] };
    const minf = { type: "minf", body: [] };

    // ---------------------------------------------------------
    // 2. Build MDIA
    // ---------------------------------------------------------
    const node = emitMdiaBox({
        mdhd,
        hdlr,
        minf
    });

    const mdia = serializeBoxTree(node);

    // ---------------------------------------------------------
    // 3. Structural assertions
    // ---------------------------------------------------------
    assertExists("mdhd", extractChildBoxFromContainer(mdia, "mdhd"));
    assertExists("hdlr", extractChildBoxFromContainer(mdia, "hdlr"));
    assertExists("minf", extractChildBoxFromContainer(mdia, "minf"));

    // ---------------------------------------------------------
    // 4. Ordering assertions
    // ---------------------------------------------------------
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

    console.log("PASS: MDIA structural correctness");
}


/**
 * MDIA — Locked Layout Equivalence (ffmpeg)
 * ----------------------------------------
 *
 * Validates that MDIA serializes identically to ffmpeg
 * when provided with the same resolved child boxes.
 *
 * All policy decisions are injected.
 */
export async function testMdia_LockedLayoutEquivalence_ffmpeg() {

    console.log("=== testMdia_LockedLayoutEquivalence_ffmpeg ===");

    // ---------------------------------------------------------
    // 1. Load golden MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Extract reference MDIA
    // ---------------------------------------------------------
    const refMdia = extractBoxByPathFromMp4(
        mp4,
        "moov/trak/mdia"
    );

    assertExists("reference mdia", refMdia);

    // ---------------------------------------------------------
    // 3. Read golden truth MDIA
    // ---------------------------------------------------------
    const truth = getGoldenTruthBox.fromMp4(
        mp4,
        "moov/trak/mdia"
    );

    const params = truth.getBuilderInput();

    // ---------------------------------------------------------
    // 4. Rebuild MDIA exclusively from golden truth
    // ---------------------------------------------------------
    const out = serializeBoxTree(
        emitMdiaBox(params)
    );

    // ---------------------------------------------------------
    // 5. Child-level byte equivalence
    // ---------------------------------------------------------
    const refContainer = asContainer(refMdia);
    const outContainer = asContainer(out);

    const refMeta = refContainer.enumerateChildren();

    for (let i = 0; i < refMeta.length; i++) {
        const { type } = refMeta[i];

        const refChildBytes = extractChildBoxFromContainer(
            refMdia,
            type
        );

        const outChildBytes = extractChildBoxFromContainer(
            out,
            type
        );

        assertEqual(
            `mdia.${type}.size`,
            outChildBytes.length,
            refChildBytes.length
        );

        for (let j = 0; j < refChildBytes.length; j++) {
            assertEqual(
                `mdia.${type}.byte[${j}]`,
                outChildBytes[j],
                refChildBytes[j]
            );
        }
    }

    console.log("PASS: MDIA matches ffmpeg byte-for-byte");
}
