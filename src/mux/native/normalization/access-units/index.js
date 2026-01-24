import { addAccessUnitDurationsInPlace } from "./addAccessUnitDurations.js";

export function normalizeAccessUnitsInPlace({
    accessUnits,
    codec,
    trackDuration
}) {


    addAccessUnitDurationsInPlace({
        accessUnits,
        codec,
        trackDuration
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

