/**
 * extractSemanticAccessUnitsFromMp4
 *
 * Semantic extractor.
 *
 * Returns semantic access units only:
 *   - pts
 *   - dts
 *   - duration
 *   - isKey
 *
 * Byte payloads are NOT returned.
 * Payloads must be extracted separately via:
 *   extractAccessUnitPayloadsFromMp4
 *
 * This function performs NO container policy.
 */
import { getGoldenTruthBox } from "../goldenTruthExtractors/index.js";

export function extractSemanticAccessUnitsFromMp4({
    mp4Bytes,
    trackIndex = 0
}) {
    throwIfMissing(mp4Bytes);

    const stbl =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4Bytes,
                `moov/trak[${trackIndex}]/mdia/minf/stbl`
            )
            .readBoxReport();

    if (!stbl.derived || !Array.isArray(stbl.derived.samples)) {
        throw new Error(
            "stbl.readBoxReport().derived.samples missing"
        );
    }

    return stbl.derived.samples.map(sample => ({
        pts: sample.pts,
        dts: sample.dts,
        duration: sample.duration,
        size: sample.size,
        isKey: sample.isSync
    }));

}

function throwIfMissing(mp4Bytes) {
    if (!(mp4Bytes instanceof Uint8Array)) {
        throw new Error("expected Uint8Array mp4Bytes");
    }
}
