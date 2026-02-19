export const hvc1Profile = Object.freeze({
    id: "hvc1",
    mediaFamily: "video",
    sampleEntryTypes: Object.freeze(["hvc1", "hev1"]),
    configKeys: Object.freeze(["config"]),
    supportsMuxEmission: false,
    editListMediaTimeStrategy: "encoder_delay_samples",
    hasImplicitAudioDurationTrim: false,
    stsdAssemblyPath: null,

    extractDemuxCodecConfig({ sampleEntryReport, callerLabel }) {
        const sampleEntryType = sampleEntryReport.box?.type;
        if (!(sampleEntryReport.derived.hvcC instanceof Uint8Array)) {
            throw new Error(`${callerLabel}: hvcC missing from ${sampleEntryType} SampleEntry`);
        }

        return {
            codec: sampleEntryReport.box.type, // "hvc1" or "hev1"
            config: {
                representation: "container",
                bytes: sampleEntryReport.derived.hvcC
            }
        };
    },

    adaptStsdParamsFromSemanticTrack({ codecName }) {
        throw new Error(
            `hvc1 profile: mux emission not yet supported for codec '${codecName}'`
        );
    },

    buildStsdAssemblyInputFromParams() {
        throw new Error("hvc1 profile: mux emission not yet supported");
    }
});
