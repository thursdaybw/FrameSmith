import { deriveDecodeTimestampsInPlace } from "../derivers/deriveDecodeTimestampsInPlace.js";
import { DecodeOrderStrategies } from "../derivers/strategies/decodeOrderStrategies.js";
import { assertEqual, assertExists } from "./assertions.js";
import { addAccessUnitDurationsInPlace } from "../normalization/access-units/addAccessUnitDurations.js";

export async function test_DeriveDecodeTimestamps_Invariants() {

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
    addAccessUnitDurationsInPlace({ accessUnits });

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

