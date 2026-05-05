import { addAccessUnitDurationsInPlace } from "./addAccessUnitDurations.js";

/**
 * Normalizes access units into a compiler-ready form.
 *
 * Guarantees:
 * - each access unit has a derived `duration` (computed from PTS adjacency)
 * - each access unit has `sampleDescriptionIndex = 1`
 *
 * Notes:
 * - WebCodecs provides PTS, not duration
 * - all outcomes here are single-valid and non-policy decisions
 *
 *  TESTS 
 *
 *    testNativeMuxer_NormalizeAccessUnitsInPlace_WebCodecs
 */
export function normalizeAccessUnitsInPlace({
    accessUnits,
    codec,
    trackDuration,
    sttsPolicy,
}) {

    addAccessUnitDurationsInPlace({
        accessUnits,
        codec,
        trackDuration,
        sttsPolicy,
    });

    addSampleDescriptionIndexInPlace({ accessUnits });

}

function addSampleDescriptionIndexInPlace({ accessUnits }) {

    if (!Array.isArray(accessUnits)) {
        throw new Error(
            "addSampleDescriptionIndex: accessUnits must be an array"
        );
    }

    for (let index = 0; index < accessUnits.length; index++) {
        accessUnits[index].sampleDescriptionIndex = 1;
    }
}

