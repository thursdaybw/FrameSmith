import { assertEqual } from "./assertions.js";
import { getGoldenTruthBox } from "./goldenTruthExtractors/index.js";
import { extractSemanticAccessUnitsFromMp4 } from "../demux/container/extractSemanticAccessUnitsFromMp4.js";

export async function test_extractSemanticAccessUnitsFromMp4_mapsSyncToIsKey() {
    const response = await fetch("reference/reference_av.mp4");
    const mp4Bytes = new Uint8Array(await response.arrayBuffer());

    const trackIndex = 0; // video
    const semanticUnits = extractSemanticAccessUnitsFromMp4({
        mp4Bytes,
        zeroBasedTrackIndex: trackIndex
    });

    const stblReport = getGoldenTruthBox
        .getSemanticBoxDataByPathFromMp4File(
            mp4Bytes,
            `moov/trak[${trackIndex}]/mdia/minf/stbl`
        )
        .readBoxReport();

    const referenceSamples = stblReport.derived.samplesOneSamplePerFrame;

    assertEqual(
        "sample count must match STBL derivation",
        semanticUnits.length,
        referenceSamples.length
    );

    for (let i = 0; i < semanticUnits.length; i++) {
        assertEqual(
            `sample[${i}].isKey must mirror STBL sync truth`,
            semanticUnits[i].isKey,
            referenceSamples[i].isSync
        );
    }
}

