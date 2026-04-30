/**
 * STBL → Derived Packet Samples Definition Test
 *
 * This test defines the executable contract for
 * deriveSamplesOnePerPacketFromStbl().
 *
 * It asserts:
 * - shape
 * - ordering
 * - packet-level invariants
 *
 * It does NOT assert:
 * - exact packet boundaries
 * - codec behavior
 * - exact timestamps or sizes
 */

import {
    assertExists,
    assertEqual
} from "./assertions.js";

import { getGoldenTruthBox }
    from "./goldenTruthExtractors/index.js";

import {
    deriveSamplesOnePerPacketFromStbl
} from "./goldenTruthExtractors/stbl/deriveSamplesOnePerPacketFromStbl.js";

export async function test_DeriveSamplesOnePerPacketFromStbl_Definition() {

    const resp =
        await fetch("reference/reference_av.mp4");

    const mp4 =
        new Uint8Array(await resp.arrayBuffer());

    // Resolve a concrete STBL box (audio track is intentional)
    const stbl =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4,
                "moov/trak[1]/mdia/minf/stbl"
            )
            .readBoxReport();

    assertExists("stbl.readBoxReport()", stbl);
    assertExists("stbl.raw", stbl.raw);

    // ---------------------------------------------------------
    // Invoke derivation
    // ---------------------------------------------------------

    const packets =
        deriveSamplesOnePerPacketFromStbl(stbl.raw);

    // ---------------------------------------------------------
    // TOP-LEVEL SHAPE
    // ---------------------------------------------------------

    assertEqual(
        "packets is array",
        Array.isArray(packets),
        true
    );

    assertEqual(
        "at least one packet present",
        packets.length > 0,
        true
    );

    // ---------------------------------------------------------
    // PER-PACKET SHAPE (contract)
    // ---------------------------------------------------------

    const first = packets[0];

    assertExists("packet.pts", first.pts);
    assertExists("packet.dts", first.dts);
    assertExists("packet.duration", first.duration);
    assertExists("packet.size", first.size);
    assertExists("packet.offset", first.offset);
    assertExists("packet.isKey", first.isKey);
    assertExists("packet.packetIndex", first.packetIndex);

    // ---------------------------------------------------------
    // INVARIANTS
    // ---------------------------------------------------------

    assertEqual(
        "packet.packetIndex is integer",
        Number.isInteger(first.packetIndex),
        true
    );

    assertEqual(
        "packet.size is integer",
        Number.isInteger(first.size),
        true
    );

    assertEqual(
        "packet.offset is integer",
        Number.isInteger(first.offset),
        true
    );

    assertEqual(
        "packet.isKey is boolean",
        typeof first.isKey === "boolean",
        true
    );

    // Ordering invariant
    assertEqual(
        "packets are packetIndex-ordered",
        packets.every((p, i) => p.packetIndex === i),
        true
    );
}
