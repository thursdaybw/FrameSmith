export function addAccessUnitDurationsInPlace({
    accessUnits,
    codec,
    trackDuration
}) {

    assertNonEmptyArray(accessUnits);
    assertPtsPresent(accessUnits);

    addDurationsByPtsAdjacency({
        accessUnits,
        codec,
        trackDuration
    });

    const total = accessUnits.reduce((s, u) => s + u.duration, 0);
}

function assertNonEmptyArray(accessUnits) {
    if (!Array.isArray(accessUnits)) {
        throw new Error(
            "addAccessUnitDurations: accessUnits must be an array"
        );
    }

    if (accessUnits.length === 0) {
        throw new Error(
            "addAccessUnitDurations: accessUnits must not be empty"
        );
    }
}

function assertPtsPresent(accessUnits) {
    for (let i = 0; i < accessUnits.length; i++) {
        if (!Number.isInteger(accessUnits[i].pts)) {
            throw new Error(
                `addAccessUnitDurations: invalid pts at index ${i}`
            );
        }
    }
}

/**
 * Adds duration to each access unit by examining adjacency
 * in PTS order, NOT array order.
 *
 * Original accessUnits order is preserved.
 */
function addDurationsByPtsAdjacency({
    accessUnits,
    codec,
    trackDuration
}) {

    // ---------------------------------------------------------
    // Build PTS-ordered index map
    // ---------------------------------------------------------
    const indicesByPts = accessUnits
        .map((_, index) => index)
        .sort((a, b) => accessUnits[a].pts - accessUnits[b].pts);

    // ---------------------------------------------------------
    // Compute durations in PTS order
    // ---------------------------------------------------------
    const durationByIndex = new Map();

    for (let i = 0; i < indicesByPts.length; i++) {

        const currentIndex = indicesByPts[i];
        const currentPts = accessUnits[currentIndex].pts;

        let duration;

        if (i < indicesByPts.length - 1) {
            const nextIndex = indicesByPts[i + 1];
            const nextPts = accessUnits[nextIndex].pts;

            duration = nextPts - currentPts;
        } else {
            if (indicesByPts.length === 1) {
                throw new Error(
                    "addAccessUnitDurations: cannot infer duration for single-sample track"
                );
            }

            const prevIndex = indicesByPts[i - 1];
            const prevPrevIndex = indicesByPts[i - 2];

            duration =
                accessUnits[prevIndex].pts -
                accessUnits[prevPrevIndex].pts;
        }

        if (!Number.isInteger(duration) || duration < 0) {
            throw new Error(
                [
                    "addAccessUnitDurations: invalid derived duration",
                    `pts=${currentPts}`,
                    `duration=${duration}`
                ].join("\n")
            );
        }

        durationByIndex.set(currentIndex, duration);
    }


    // ---------------------------------------------------------
    // AAC tail reconciliation (semantic fix)
    // ---------------------------------------------------------
    if ( typeof trackDuration === "number" && codec && codec.startsWith("mp4a")) {

        let accumulated = 0;

        const indices = Array.from(durationByIndex.keys())
            .sort((a, b) => accessUnits[a].pts - accessUnits[b].pts);

        for (let i = 0; i < indices.length - 1; i++) {
            accumulated += durationByIndex.get(indices[i]);
        }

        const lastIndex = indices[indices.length - 1];
        const reconciled =
            trackDuration - accumulated;

        if (reconciled > 0) {
            durationByIndex.set(lastIndex, reconciled);
        }
    }

    // ---------------------------------------------------------
    // Apply durations back to original access units
    // ---------------------------------------------------------
    for (const [index, duration] of durationByIndex.entries()) {
        accessUnits[index].duration = duration;
    }
}
