import { serializeBoxTree } from "../serializer/serializeBoxTree.js";
import { readUint32 } from "../bytes/mp4ByteReader.js";
import { assertEqual } from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";

export async function testCtts_Structure() {

    // ---------------------------------------------------------
    // Canonical version-0 layout
    // ---------------------------------------------------------
    const entries = [
        { count: 10, offset: 0 },
        { count: 5,  offset: 2 }
    ];

    const node =
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/ctts",
            { entries }
        );

    // ---------------------------------------------------------
    // Box identity
    // ---------------------------------------------------------
    assertEqual("ctts.type", node.type, "ctts");
    assertEqual("ctts.version", node.version, 0);
    assertEqual("ctts.flags", node.flags, 0);

    // ---------------------------------------------------------
    // Body shape
    // ---------------------------------------------------------
    // entry_count + (count, offset) * N
    const expectedBodyLength = 1 + (entries.length * 2);

    assertEqual(
        "ctts.body.length",
        node.body.length,
        expectedBodyLength
    );

    // ---------------------------------------------------------
    // Entry count
    // ---------------------------------------------------------
    assertEqual(
        "ctts.entry_count",
        node.body[0].int,
        entries.length
    );

    // ---------------------------------------------------------
    // Entry payload (flat)
    // ---------------------------------------------------------
    let cursor = 1;

    for (let i = 0; i < entries.length; i++) {

        assertEqual(
            `ctts.entry[${i}].count`,
            node.body[cursor++].int,
            entries[i].count
        );

        assertEqual(
            `ctts.entry[${i}].offset`,
            node.body[cursor++].int,
            entries[i].offset
        );
    }

    // ---------------------------------------------------------
    // Defensive immutability
    // ---------------------------------------------------------
    entries[0].count = 999;

    assertEqual(
        "ctts.immutability",
        node.body[1].int,
        10
    );
}

export async function testCtts_LockedLayoutEquivalence_ffmpeg() {

    // ---------------------------------------------------------
    // 1. Load golden MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // 2. Parse reference CTTS via parser registry
    // ---------------------------------------------------------
    const parsed = getGoldenTruthBox.getSemanticBoxDataByPathFromMp4File(
        mp4,
        "moov/trak[0]/mdia/minf/stbl/ctts",
    );

    const refFields = parsed.readBoxReport();
    const buildParams = parsed.getEmitterInput();

    // ---------------------------------------------------------
    // 3. Rebuild CTTS via Framesmith
    // ---------------------------------------------------------
    const outCtts = serializeBoxTree(
        EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/ctts",
            buildParams
        )
    );

    // ---------------------------------------------------------
    // 4. Byte-for-byte equivalence
    // ---------------------------------------------------------
    const refRaw = refFields.raw;

    assertEqual(
        "ctts.size",
        outCtts.length,
        refRaw.length
    );

    for (let i = 0; i < refRaw.length; i++) {
        assertEqual(
            `ctts.byte[${i}]`,
            outCtts[i],
            refRaw[i]
        );
    }

}

