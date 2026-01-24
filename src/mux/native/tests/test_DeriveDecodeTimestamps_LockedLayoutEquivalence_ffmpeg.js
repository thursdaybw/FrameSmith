import { deriveDecodeTimestampsInPlace }
    from "../derivers/deriveDecodeTimestampsInPlace.js";

import { DecodeOrderStrategies }
    from "../derivers/strategies/decodeOrderStrategies.js";

import { extractSemanticAccessUnitsFromMp4 }
    from "./reference/extractSemanticAccessUnitsFromMp4.js";

import { getGoldenTruthBox }
    from "./goldenTruthExtractors/index.js";

import { assertEqual }
    from "./assertions.js";

export async function test_DeriveDecodeTimestamps_LockedLayoutEquivalence_ffmpeg() {

    console.log(
        "=== test_DeriveDecodeTimestamps_LockedLayoutEquivalence_ffmpeg ==="
    );

    // ---------------------------------------------------------
    // Load golden MP4
    // ---------------------------------------------------------
    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    // ---------------------------------------------------------
    // Extract semantic accessUnits (PTS + isKey only)
    // ---------------------------------------------------------
    const accessUnits =
        extractSemanticAccessUnitsFromMp4({ mp4Bytes: mp4 });

    // ---------------------------------------------------------
    // Derive DTS using locked strategy
    // ---------------------------------------------------------
    deriveDecodeTimestampsInPlace({
        accessUnits,
        strategy:
            DecodeOrderStrategies.DECODE_ORDER_EQUALS_SAMPLE_ORDER
    });

    // ---------------------------------------------------------
    // Extract reference DTS via CTTS
    // ---------------------------------------------------------
    const ctts =
        getGoldenTruthBox
            .fromMp4(
                mp4,
                "moov/trak[0]/mdia/minf/stbl/ctts",
            )
            .readBoxReport();

    // Expand run-length encoded CTTS into per-accessUnits offsets
    const refOffsets = [];

    for (const entry of ctts.entries) {
        for (let i = 0; i < entry.count; i++) {
            refOffsets.push(entry.offset);
        }
    }

    // ---------------------------------------------------------
    // Compare DTS accessUnit-by-accessUnit
    // ---------------------------------------------------------
    for (let i = 0; i < accessUnits.length; i++) {
        const expectedDts =
            accessUnits[i].pts - refOffsets[i];

        assertEqual(
            `accessUnits[${i}].dts`,
            accessUnits[i].dts,
            expectedDts
        );
    }

    console.log(
        "PASS: derived DTS matches ffmpeg output exactly"
    );
}
