import { getGoldenTruthBox } from "../../tests/goldenTruthExtractors/index.js";
import { extractDemuxCodecConfigBySampleEntryType } from "../../codecs/codecRegistry.js";

export function extractTrackCodecConfigurationFromMp4({ mp4Bytes, zeroBasedTrackIndex }) {

    // ---------------------------------------------------------
    // Input validation
    // ---------------------------------------------------------

    if (!(mp4Bytes instanceof Uint8Array)) {
        throw new Error(
            "extractTrackCodecConfigurationFromMp4UsingZeroBasedTrackIndex: " +
            "mp4Bytes must be Uint8Array"
        );
    }

    if (!Number.isInteger(zeroBasedTrackIndex) || zeroBasedTrackIndex < 0) {
        throw new Error(
            "extractTrackCodecConfigurationFromMp4UsingZeroBasedTrackIndex: " +
            "zeroBasedTrackIndex must be a non-negative integer"
        );
    }

    // ---------------------------------------------------------
    // Resolve SampleEntry (structural exception lives here)
    // ---------------------------------------------------------

    const sampleEntryReport =
        getGoldenTruthBox
            .getSemanticBoxDataByPathFromMp4File(
                mp4Bytes,
                `moov/trak[${zeroBasedTrackIndex}]/mdia/minf/stbl/stsd/sample[0]`
            )
            .readBoxReport();

    if (!sampleEntryReport || !sampleEntryReport.box) {
        throw new Error(
            "extractTrackCodecConfigurationFromMp4UsingZeroBasedTrackIndex: " +
            "missing SampleEntry for track"
        );
    }

    return extractDemuxCodecConfigBySampleEntryType({
        sampleEntryReport,
        callerLabel: "extractTrackCodecConfigurationFromMp4UsingZeroBasedTrackIndex"
    });
}
