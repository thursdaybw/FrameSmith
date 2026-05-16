import { EmitterRegistry } from "../../box-emitters/EmitterRegistry.js";
import { readFourCC } from "../../box-schema/boxLayoutReaders.js";

/**
 * assembleOpusSampleEntry
 * =======================
 *
 * Assembler for Opus SampleEntry.
 *
 * Responsibilities:
 * - Validate intent
 * - Build child boxes (dOps, btrt)
 * - Attach children to Opus container
 */
export function assembleOpusSampleEntry(intent, { emitContainer }) {

    if (typeof intent !== "object" || intent === null) {
        throw new Error("assembleOpusSampleEntry: intent must be an object");
    }

    const {
        reserved1,
        reserved2,
        reserved3,
        reserved4,
        reserved5,
        reserved6,
        dataReferenceIndex,
        reserved7,
        reserved8,
        channelCount,
        sampleSize,
        preDefined1,
        preDefined2,
        sampleRate,
        dOps,
        btrt
    } = intent;

    let dOpsNode = null;

    if (dOps !== undefined) {
        dOpsNode = EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/stsd|Opus/dOps",
            dOps,
        );
    }

    let btrtNode = null;
    if (btrt !== undefined) {
        btrtNode = EmitterRegistry.emit(
            "moov/trak/mdia/minf/stbl/stsd|Opus/btrt",
            btrt
        );
    }

    return emitContainer(
        "moov/trak/mdia/minf/stbl/stsd|Opus",
        {
            reserved1,
            reserved2,
            reserved3,
            reserved4,
            reserved5,
            reserved6,
            dataReferenceIndex,
            reserved7,
            reserved8,
            channelCount,
            sampleSize,
            preDefined1,
            preDefined2,
            sampleRate,
            ...(dOpsNode ? { dOpsNode } : {}),
            ...(btrtNode ? { btrtNode } : {})
        }
    );
}
export function registerOpusSampleEntryAssembler(registry) {
    registry.registerAssembler(
        "moov/trak/mdia/minf/stbl/stsd|Opus",
        assembleOpusSampleEntry
    );
}
