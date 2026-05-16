import { getGoldenTruthBox } from "../goldenTruthExtractors/index.js";

export function extractTrackDurationFromOracleStts({
    mp4Bytes,
    zeroBasedTrackIndex
}) {

    const stts = getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4Bytes,
                `moov/trak[${zeroBasedTrackIndex}]/mdia/minf/stbl/stts`
            )
            .readBoxReport()
            .box;

    const entries = stts.fields.entries;

    let totalDuration = 0;

    for (const entry of entries) {
        totalDuration += entry.sampleCount * entry.sampleDelta;
    }

    return totalDuration;
}
