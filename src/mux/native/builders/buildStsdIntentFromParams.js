import { EmitterRegistry } from "../box-emitters/EmitterRegistry.js";

export function buildStsdIntentFromParams(stsdParams) {

    if (!stsdParams) {
        throw new Error(
            "buildStsdIntentFromTrack: stsdParams is required"
        );
    }

    let sampleEntryNode;

    if (stsdParams.codec === "avc1") {

        sampleEntryNode = EmitterRegistry.assemble(
            "moov/trak/mdia/minf/stbl/stsd|avc1",
            {
                width:          stsdParams.width,
                height:         stsdParams.height,
                compressorName: stsdParams.compressorName,
                avcC:           stsdParams.avcC,
                pasp:           stsdParams.pasp,
                btrt:           stsdParams.btrt,
            }
        );

    } else if (stsdParams.codec === "mp4a") {

        sampleEntryNode = EmitterRegistry.assemble(
            "moov/trak/mdia/minf/stbl/stsd|mp4a",
            {
                channelCount: stsdParams.channelCount,
                sampleRate:   stsdParams.sampleRate,
                sampleSize:   stsdParams.sampleSize,
                esds:         stsdParams.esds,
                btrt:         stsdParams.btrt,
            }
        );

    } else if (stsdParams.codec === "opus") {

        sampleEntryNode = EmitterRegistry.assemble(
            "moov/trak/mdia/minf/stbl/stsd|Opus",
            {
                channelCount:       stsdParams.channelCount,
                sampleRate:         stsdParams.sampleRate,
                sampleSize:         stsdParams.sampleSize,
                dataReferenceIndex: stsdParams.dataReferenceIndex,
                dOps:               stsdParams.dOps,
                btrt:               stsdParams.btrt,
            }
        );

    } else {
        throw new Error(
            "buildStsdIntentFromTrack: unsupported codec " +
            stsdParams.codec
        );
    }

    return {
       sampleEntries: [ sampleEntryNode ]
    };
}
