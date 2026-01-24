import { getGoldenTruthBox }
    from "../goldenTruthExtractors/index.js";

export function
extractTrackCodecConfigurationFromMp4UsingZeroBasedTrackIndex({
    mp4Bytes,
    zeroBasedTrackIndex
}) {

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

    const sampleEntryType = sampleEntryReport.box.type;

    // ---------------------------------------------------------
    // Video: AVC (avc1)
    // ---------------------------------------------------------
    // ---------------------------------------------------------
    // Codec identity declaration (source-level responsibility)
    // ---------------------------------------------------------
    //
    // Video and audio tracks require a *codec identifier string* that
    // names the encoding format in a standardized, interoperable way.
    //
    // This string is a LABEL, not a configuration.
    // It answers the question:
    //
    //   "What kind of media is this track?"
    //
    // Examples:
    //   - "avc1"  → H.264 / AVC video
    //   - "mp4a"  → MPEG-4 AAC audio
    //
    // The actual decoder configuration (SPS/PPS, profiles, levels, etc.)
    // lives elsewhere (e.g. in `avcC`) and is treated as opaque bytes.
    //
    // IMPORTANT ARCHITECTURAL RULE:
    // ------------------------------
    // Codec identity is NOT inferred from container structure.
    // It MUST be declared explicitly by the source adapter.
    //
    // For Golden MP4 test fixtures:
    // - the source is a known, fixed oracle
    // - the sample entry type ("avc1") is authoritative
    // - we declare the codec identity directly and explicitly
    //
    // This avoids guesswork and keeps responsibility at the system boundary.


    if (sampleEntryType === "avc1") {

        if (!(sampleEntryReport.derived.avcC instanceof Uint8Array)) {
            throw new Error(
                "extractTrackCodecConfigurationFromMp4UsingZeroBasedTrackIndex: " +
                "avcC missing from avc1 SampleEntry"
            );
        }

        return {
            codec: "avc1",
            avcC: sampleEntryReport.derived.avcC,
            avcCCompleteness: "container-complete"
        };
    }

    // ---------------------------------------------------------
    // Audio: AAC (mp4a)
    // ---------------------------------------------------------

    if (sampleEntryType === "mp4a") {

        if (!(sampleEntryReport.derived.esds instanceof Uint8Array)) {
            throw new Error(
                "extractTrackCodecConfigurationFromMp4UsingZeroBasedTrackIndex: " +
                "esds missing from mp4a SampleEntry"
            );
        }

        // ---------------------------------------------------------
        // Container-declared audio shape (SampleEntry fields)
        // ---------------------------------------------------------
        const channelCount =
            sampleEntryReport.box?.fields?.channelCount;

        const sampleRate =
            sampleEntryReport.box?.fields?.sampleRate;

        if (!Number.isInteger(channelCount) || channelCount <= 0) {
            throw new Error(
                "extractTrackCodecConfigurationFromMp4UsingZeroBasedTrackIndex: " +
                "mp4a.channelCount missing or invalid"
            );
        }

        if (!Number.isInteger(sampleRate) || sampleRate <= 0) {
            throw new Error(
                "extractTrackCodecConfigurationFromMp4UsingZeroBasedTrackIndex: " +
                "mp4a.sampleRate missing or invalid"
            );
        }

        return {
            codec: "mp4a",
            esds: sampleEntryReport.derived.esds,
            channelCount,
            sampleRate
        };

    }

    // ---------------------------------------------------------
    // Unsupported codec
    // ---------------------------------------------------------

    throw new Error(
        "extractTrackCodecConfigurationFromMp4UsingZeroBasedTrackIndex: " +
        `unsupported SampleEntry type '${sampleEntryType}'`
    );
}
