import { readUint32 } from "../bytes/mp4ByteReader.js";
import { assertEqual, assertEqualHex } from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";
import { serializeBoxTree } from "../serializer/serializeBoxTree.js";

/**
 * testDref_Structure
 * ------------------
 * Phase B — Structural correctness test for dref.
 *
 * This test asserts the emitted box *model*, not serialized bytes.
 *
 * Guarantees:
 * - Correct box type and FullBox header
 * - Exactly one entry_count
 * - Exactly one child `url ` box
 * - Correct child FullBox header
 * - No payload fields
 */
export function testDref_Structure() {

    // ------------------------------------------------------------
    // 1. Emit box model via registry (NO serialization)
    // ------------------------------------------------------------
    const node =
        EmitterRegistry.assemble(
            "moov/trak/mdia/minf/dinf/dref",
            {}
        );

    // ------------------------------------------------------------
    // 2. Parent box: dref
    // ------------------------------------------------------------
    assertEqual("dref.type",    node.type,    "dref");
    assertEqual("dref.version", node.version, 0);
    assertEqual("dref.flags",   node.flags,   0);

    // ------------------------------------------------------------
    // 3. Body fields
    // ------------------------------------------------------------
    assertEqual(
        "dref.body.length",
        node.body.length,
        1
    );

    assertEqual(
        "dref.entry_count",
        node.body[0].int,
        1
    );

    // ------------------------------------------------------------
    // 4. Child boxes
    // ------------------------------------------------------------
    assertEqual(
        "dref.children.length",
        node.children.length,
        1
    );

    const url = node.children[0];

    assertEqual("dref.url.type",    url.type,    "url ");
    assertEqual("dref.url.version", url.version, 0);
    assertEqual("dref.url.flags",   url.flags,   1);

    // ------------------------------------------------------------
    // 5. url box has no payload
    // ------------------------------------------------------------
    assertEqual(
        "dref.url.body.length",
        url.body.length,
        0
    );

    assertEqual(
        "dref.url.children.length",
        url.children ? url.children.length : 0,
        0
    );
}

export async function testDref_LockedLayoutEquivalence_ffmpeg() {

    // ------------------------------------------------------------
    // Load golden MP4
    // ------------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ------------------------------------------------------------
    // Read golden truth (validation + raw bytes)
    // ------------------------------------------------------------
    const truth =
        getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
            mp4,
            "moov/trak[0]/mdia/minf/dinf/dref"
        );

    const refFields = truth.readBoxReport();
    const params    = truth.getEmitterInput(); // {}

    // ------------------------------------------------------------
    // Rebuild dref via registry
    // ------------------------------------------------------------
    const outBytes = serializeBoxTree(
        EmitterRegistry.assemble(
            "moov/trak/mdia/minf/dinf/dref",
            params
        )
    );

    // ------------------------------------------------------------
    // Byte-for-byte equivalence
    // ------------------------------------------------------------
    const refRaw = refFields.raw;

    assertEqual(
        "dref.size",
        outBytes.length,
        refRaw.length
    );

    for (let i = 0; i < refRaw.length; i++) {
        assertEqualHex(
            `dref.byte[${i}]`,
            outBytes[i],
            refRaw[i]
        );
    }
}
