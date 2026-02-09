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

    const fixtures = [
        {
            label: "reference_visual",
            path: "reference/reference_visual.mp4",
            trackIndices: [0]
        },
        {
            label: "reference_av",
            path: "reference/reference_av.mp4",
            trackIndices: [0, 1]
        },
        {
            label: "reference_av_opus",
            path: "reference/reference_av_opus.mp4",
            trackIndices: [0, 1]
        }
    ];

    for (const fixture of fixtures) {

        // ---------------------------------------------------------
        // 1. Load oracle MP4
        // ---------------------------------------------------------
        const resp = await fetch(fixture.path);
        const mp4  = new Uint8Array(await resp.arrayBuffer());

        for (const trackIndex of fixture.trackIndices) {

            const cttsPath =
                `moov/trak[${trackIndex}]/mdia/minf/stbl/ctts`;

            const parsed =
                getGoldenTruthBox
                .getSemanticBoxDataByPathFromMp4File(
                    mp4,
                    cttsPath
                );

            if (parsed && parsed.found === false) {
                console.log(
                    `[CTTS] ${fixture.label} track ${trackIndex}: ABSENT`
                );
                continue;
            }

            // ---------------------------------------------------------
            // 2. Diagnostic log
            // ---------------------------------------------------------
            console.log(
                `[CTTS] ${fixture.label} track ${trackIndex}: PRESENT`
            );

            // ---------------------------------------------------------
            // 3. Parse oracle CTTS
            // ---------------------------------------------------------
            const refReport = parsed.readBoxReport();
            const buildParams = parsed.getEmitterInput();

            // ---------------------------------------------------------
            // 4. Re-emit CTTS
            // ---------------------------------------------------------
            const outCtts =
                serializeBoxTree(
                    EmitterRegistry.emit(
                        "moov/trak/mdia/minf/stbl/ctts",
                        buildParams
                    )
                );

            const refRaw = refReport.raw;

            // ---------------------------------------------------------
            // 5. Byte-for-byte equivalence
            // ---------------------------------------------------------
            assertEqual(
                `[${fixture.label} t${trackIndex}] ctts.size`,
                outCtts.length,
                refRaw.length
            );

            for (let i = 0; i < refRaw.length; i++) {
                assertEqual(
                    `[${fixture.label} t${trackIndex}] ctts.byte[${i}]`,
                    outCtts[i],
                    refRaw[i]
                );
            }
        }
    }
}
