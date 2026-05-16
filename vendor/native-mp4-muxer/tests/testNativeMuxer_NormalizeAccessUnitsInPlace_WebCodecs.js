import {
    normalizeAccessUnitsInPlace
} from "../normalization/access-units/index.js";

import { getSumOfAccessUnitDurations } from "../compiler/compileMp4.js";

import { assertEqual, assertExists } from "./assertions.js";

async function loadWebCodecsFixtures() {
    const resp = await fetch(
        "./fixtures/webcodecs_opus_av_access_units.json"
    );
    return await resp.json();
}

export async function testNativeMuxer_NormalizeAccessUnitsInPlace_WebCodecs() {

    const webcodecsFixtures = await loadWebCodecsFixtures();

    for (const fixture of webcodecsFixtures) {

        const accessUnits = fixture.accessUnits.map(u => ({ ...u }));

        // -----------------------------------------------------
        // Precondition: no durations
        // -----------------------------------------------------
        for (const u of accessUnits) {
            assertEqual(
                "precondition: duration absent",
                u.duration,
                undefined
            );
        }

        // -----------------------------------------------------
        // Normalize
        // -----------------------------------------------------
        normalizeAccessUnitsInPlace({
            accessUnits,
            codec: fixture.codec
        });

        // -----------------------------------------------------
        // Postconditions: duration + sampleDescriptionIndex
        // -----------------------------------------------------
        for (const u of accessUnits) {

            assertExists("duration", u.duration);
            assertEqual(
                "duration is integer",
                Number.isInteger(u.duration),
                true
            );

            assertEqual(
                "sampleDescriptionIndex",
                u.sampleDescriptionIndex,
                1
            );
        }

        // -----------------------------------------------------
        // PTS adjacency rule
        // -----------------------------------------------------
        const byPts = [...accessUnits].sort(
            (a, b) => a.pts - b.pts
        );

        for (let i = 0; i < byPts.length - 1; i++) {

            assertEqual(
                "duration = nextPts - currentPts",
                byPts[i].duration,
                byPts[i + 1].pts - byPts[i].pts
            );
        }

        // Last-sample rule
        if (byPts.length > 1) {

            const last     = byPts[byPts.length - 1];
            const prev     = byPts[byPts.length - 2];
            const prevPrev = byPts[byPts.length - 3];

            assertEqual(
                "last sample duration equals previous delta",
                last.duration,
                prev.pts - prevPrev.pts
            );
        }

        // -----------------------------------------------------
        // Total duration consistency
        // -----------------------------------------------------
        const sum = getSumOfAccessUnitDurations(accessUnits);

        const firstPts = byPts[0].pts;
        const lastPts  = byPts[byPts.length - 1].pts;

        assertEqual(
            "total duration consistency",
            sum,
            lastPts + byPts[byPts.length - 1].duration - firstPts
        );
    }


}

