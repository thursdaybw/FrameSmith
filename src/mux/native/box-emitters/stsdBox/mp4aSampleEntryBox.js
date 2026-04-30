function emitMp4aSampleEntryBox({
    channelCount,
    sampleSize,
    sampleRate,
    esdsNode,
    btrtNode
}) {

    return {
        type: "mp4a",

        body: [
            // reserved[6]
            { byte: 0 }, { byte: 0 }, { byte: 0 },
            { byte: 0 }, { byte: 0 }, { byte: 0 },

            // data_reference_index
            { short: 1 },

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
            esdsNode,
            ...(btrtNode ? [btrtNode] : [])
        ]
    };
}

export function registerMp4aSampleEntryEmitter(registry) {
    registry.registerEmitter(
        "moov/trak/mdia/minf/stbl/stsd|mp4a",
        emitMp4aSampleEntryBox
    );
}
