import { emitElstBox } from "../box-emitters/elstBox.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import {
    extractBoxByPathFromMp4
} from "./reference/BoxExtractor.js";
import { readUint32 } from "../bytes/mp4ByteReader.js";
import {
    assertEqual,
    assertEqualHex,
    assertExists
} from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";

export async function testElst_Structure() {

    console.log("=== testElst_Structure ===");

    const entries = [
        {
            editDuration: 1000,
            mediaTime: 0,
            mediaRateInteger: 1,
            mediaRateFraction: 0
        }
    ];

    const node = emitElstBox({
        version: 0,
        flags: 0,
        entries
    });

    // ---------------------------------------------------------
    // Box identity
    // ---------------------------------------------------------
    assertEqual("elst.type", node.type, "elst");
    assertEqual("elst.version", node.version, 0);
    assertEqual("elst.flags", node.flags, 0);

    // ---------------------------------------------------------
    // Body structure (flattened)
    // ---------------------------------------------------------
    assertEqual("elst.body_is_array", Array.isArray(node.body), true);

    // entry_count
    assertEqual("elst.body[0].is_int", "int" in node.body[0], true);
    assertEqual("elst.entry_count", node.body[0].int, 1);

    // entry fields (version 0)
    assertEqual("editDuration", node.body[1].int, 1000);
    assertEqual("mediaTime", node.body[2].int, 0);
    assertEqual("mediaRateInteger", node.body[3].short, 1);
    assertEqual("mediaRateFraction", node.body[4].short, 0);

    console.log("PASS: ELST structural correctness");
}

/**
 * ELST — Locked Layout Equivalence (ffmpeg)
 * ----------------------------------------
 *
 * This test proves that:
 *   - ELST semantic fields are decoded correctly from ffmpeg output
 *   - buildElstBox reproduces the same binary layout
 *   - version selection logic matches ffmpeg
 *
 * This test explicitly forbids:
 *   - raw byte passthrough
 *   - container cheating
 */
export async function testElst_LockedLayoutEquivalence_ffmpeg() {

    console.log("=== testElst_LockedLayoutEquivalence_ffmpeg ===");

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const refElst = extractBoxByPathFromMp4(
        mp4,
        "moov/trak/edts/elst"
    );

    assertExists("reference elst", refElst);

    const truth = getGoldenTruthBox.fromMp4(
        mp4,
        "moov/trak/edts/elst"
    );

    const input = truth.getBuilderInput();

    const out = serializeBoxTree(
        emitElstBox(input)
    );

    // child-level equivalence does not apply (elst has no children)
    // so this is flat byte-for-byte

    for (let i = 0; i < refElst.length; i++) {
        assertEqualHex(
            `elst.byte[${i}]`,
            out[i],
            refElst[i]
        );
    }

    assertEqual(
        "elst.size",
        out.length,
        refElst.length
    );

    console.log("PASS: ELST matches ffmpeg byte-for-byte");
}
