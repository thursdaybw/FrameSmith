import { extractSemanticAccessUnitsFromMp4 } from "./reference/extractSemanticAccessUnitsFromMp4.js";

import { deriveDecodeTimestampsInPlace }
    from "../derivers/deriveDecodeTimestampsInPlace.js";

import { DecodeOrderStrategies }
    from "../derivers/strategies/decodeOrderStrategies.js";

import { assertEqual, assertExists }
    from "./assertions.js";

import { addAccessUnitDurationsInPlace }
    from "../normalization/access-units/addAccessUnitDurations.js";

export async function test_DeriveDecodeTimestamps_Invariants() {

    console.log(
        "=== test_DeriveDecodeTimestamps_Invariants " +
        "(DECODE_ORDER_EQUALS_SAMPLE_ORDER) ==="
    );

    const accessUnits = [
        { pts: 1024 },
        { pts: 3072 },
        { pts: 2048 },
        { pts: 1536 },
        { pts: 2560 }
    ];

    // ---------------------------------------------------------
    // Normalization prerequisite — durations
    // ---------------------------------------------------------
    addAccessUnitDurationsInPlace({
        accessUnits
    });

    // ---------------------------------------------------------
    // Derive DTS using selected strategy
    // ---------------------------------------------------------
    deriveDecodeTimestampsInPlace({
        accessUnits,
        strategy: DecodeOrderStrategies.DECODE_ORDER_EQUALS_SAMPLE_ORDER
    });

    // ---------------------------------------------------------
    // Invariants — presence
    // ---------------------------------------------------------

    for (let i = 0; i < accessUnits.length; i++) {
        assertExists(
            `sample[${i}].dts`,
            accessUnits[i].dts
        );
    }

    // ---------------------------------------------------------
    // Invariants — monotonic decode order (array order)
    // ---------------------------------------------------------

    for (let i = 1; i < accessUnits.length; i++) {
        assertEqual(
            `sample[${i}].dts >= sample[${i - 1}].dts`,
            accessUnits[i].dts >= accessUnits[i - 1].dts,
            true
        );
    }

    // ---------------------------------------------------------
    // Invariants — DTS never exceeds PTS (CTTS v0 requirement)
    // ---------------------------------------------------------

    for (let i = 0; i < accessUnits.length; i++) {
        assertEqual(
            `sample[${i}].dts <= pts`,
            accessUnits[i].dts <= accessUnits[i].pts,
            true
        );
    }

    // ---------------------------------------------------------
    // Invariants — constant decode duration
    // ---------------------------------------------------------

    const deltas = [];

    for (let i = 1; i < accessUnits.length; i++) {
        deltas.push(accessUnits[i].dts - accessUnits[i - 1].dts);
    }

    const firstDelta = deltas[0];

    for (let i = 0; i < deltas.length; i++) {
        assertEqual(
            `decode delta[${i}] constant`,
            deltas[i],
            firstDelta
        );
    }

    console.log(
        "PASS: decode timestamp invariants hold"
    );
}

export async function inspect_GoldenMp4_PtsDtsOrder() {

    const resp = await fetch("reference/reference_visual.mp4");
    const mp4  = new Uint8Array(await resp.arrayBuffer());

    const accessUnits = extractSemanticAccessUnitsFromMp4({
        mp4Bytes: mp4
    });

    console.log("PTS / DTS / offset");

    accessUnits.forEach((s, i) => {
        console.log({
            i,
            pts: s.pts,
            dts: s.dts,
            offset: s.pts - s.dts
        });
    });
}
