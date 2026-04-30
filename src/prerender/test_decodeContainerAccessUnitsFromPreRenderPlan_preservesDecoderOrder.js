/**
 * Pre-Render Execution — Decoder Order Preservation (Contract Test)
 *
 * This test locks the rule that execution MUST feed video decoder in decode
 * order (DTS when present), not raw timeline order.
 */

import { decodeContainerAccessUnitsFromPreRenderPlanBatch } from "./decodeContainerAccessUnitsFromPreRenderPlanBatch.js";
import { DecodedContainerBackedFragmentBatch } from "./DecodedContainerBackedFragmentBatch.js";
import {
    PreRenderPlanFragmentKinds,
    PreRenderPlanContributorKinds
} from "../timeline/planFragments.js";

function assert(condition, message) {
    if (!condition) {
        throw new Error("ASSERT FAILED: " + message);
    }
}

/**
 * test_decodeContainerAccessUnits_preservesDecoderCallAndOutputOrder
 *
 * GIVEN:
 * ------
 * - An ACCESS_UNITS fragment with units in a non-sorted PTS order
 * - DTS values that define a different decode order
 *
 * WHEN:
 * -----
 * - decodeContainerAccessUnitsFromPreRenderPlanBatch is invoked
 *
 * THEN:
 * -----
 * - decoder is called in DTS order
 * - output frames preserve that decode dispatch order
 *
 * This ensures WebCodecs receives the stream in a valid decode sequence.
 */
async function test_decodeContainerAccessUnits_preservesDecoderCallAndOutputOrder() {

    // -------------------------------------------------
    // Arrange
    // -------------------------------------------------

    const accessUnits = [
        { pts: 3000, dts: 2000, marker: 3 },
        { pts: 1000, dts: 0, marker: 1 },
        { pts: 2000, dts: 1000, marker: 2 }
    ];
    const expectedDecodePtsOrder = [1000, 2000, 3000];
    const expectedDecodeDtsOrder = [0, 1000, 2000];
    const expectedDecodeMarkerOrder = [1, 2, 3];

    const accessUnitFragment = {
        kind: PreRenderPlanFragmentKinds.ACCESS_UNITS,
        prerenderContributorKind:
            PreRenderPlanContributorKinds.CONTAINER_TRACK,
        access_units: accessUnits.map(unit => ({
            pts: unit.pts,
            dts: unit.dts,
            data: new Uint8Array([unit.marker])
        }))
    };

    const plan = {
        fragments: [ accessUnitFragment ]
    };

    const decodeCallOrder = [];

    const fakeVideoDecoder = {
        decode(chunkPayload) {
            const hasTimestamp = chunkPayload && typeof chunkPayload.timestamp === "number";
            decodeCallOrder.push({
                marker: hasTimestamp ? null : chunkPayload[0],
                timestamp: hasTimestamp ? chunkPayload.timestamp : null
            });
        },
        flush: async () => {}
    };

    // -------------------------------------------------
    // Act
    // -------------------------------------------------

    const result = await decodeContainerAccessUnitsFromPreRenderPlanBatch({
        plan,
        videoDecoder: fakeVideoDecoder
    });

    // -------------------------------------------------
    // Assert
    // -------------------------------------------------

    assert(
        result instanceof DecodedContainerBackedFragmentBatch,
        "execution must return DecodedContainerBackedFragmentBatch"
    );

    assert(
        result.decodedVideoFrames.length === accessUnits.length,
        "one video frame must be produced per access unit"
    );

    const outputPtsOrder = result.decodedVideoFrames.map(f => f.timestamp);

    assert(
        decodeCallOrder.length === accessUnits.length,
        "decoder must be called once per access unit"
    );

    assert(
        outputPtsOrder.length === expectedDecodePtsOrder.length &&
        outputPtsOrder.every((pts, i) => pts === expectedDecodePtsOrder[i]),
        "execution must emit frames in DTS decode order"
    );

    const allHaveTimestamp = decodeCallOrder.every(entry => typeof entry.timestamp === "number");

    if (allHaveTimestamp) {
        assert(
            decodeCallOrder.every((entry, i) => entry.timestamp === expectedDecodeDtsOrder[i]),
            "decoder calls must follow DTS order by timestamp"
        );
    } else {
        assert(
            decodeCallOrder.length === expectedDecodeMarkerOrder.length &&
            decodeCallOrder.every((entry, i) => entry.marker === expectedDecodeMarkerOrder[i]),
            "decoder calls must follow DTS order by marker"
        );
    }

    assert(
        decodeCallOrder.length === accessUnits.length,
        "decoder must be called once per access unit"
    );

}

export const PRERENDER_DECODE_CONTAINER_ACCESS_UNITS_ORDER_TESTS = [
    test_decodeContainerAccessUnits_preservesDecoderCallAndOutputOrder
];
