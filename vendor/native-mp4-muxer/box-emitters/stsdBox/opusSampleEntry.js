/**
 * Opus — Audio Sample Entry (Emitter)
 * ----------------------------------
 *
 * Emits the fixed AudioSampleEntry fields and
 * attaches child boxes provided by the assembler.
 *
 * This emitter does NOT construct child boxes.
 */
function emitOpusSampleEntry({
    reserved1,
    reserved2,
    reserved3,
    reserved4,
    reserved5,
    reserved6,
    dataReferenceIndex,

    // AudioSampleEntry
    channelCount,
    sampleSize,
    sampleRate,

    dOpsNode,
    btrtNode
}) {

    return {
        type: "Opus",

        body: [
            // reserved[6]
            { byte: reserved1 },
            { byte: reserved2 },
            { byte: reserved3 },
            { byte: reserved4 },
            { byte: reserved5 },
            { byte: reserved6 },

            // data_reference_index
            { short: dataReferenceIndex },

            // reserved / pre_defined
            { int: 0 },
            { int: 0 },

            // AudioSampleEntry fields
            { short: channelCount },
            { short: sampleSize },
            { short: 0 },
            { short: 0 },

            // sampleRate (16.16)
            { int: sampleRate }
        ],

        children: [
            ...(dOpsNode ? [dOpsNode] : []),
            ...(btrtNode ? [btrtNode] : [])
        ]
    };
}

export function registerOpusSampleEntryEmitter(registry) {
    registry.registerEmitter(
        "moov/trak/mdia/minf/stbl/stsd|Opus",
        emitOpusSampleEntry
    );
}
