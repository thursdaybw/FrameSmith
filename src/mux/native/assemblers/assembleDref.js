function assembleDref(intent, { emitContainer }) {

    // No intent validation needed: policy-owned

    const urlNode = {
        type: "url ",
        version: 0,
        flags: 1,
        body: [],
        children: []
    };

    return emitContainer(
        "moov/trak/mdia/minf/dinf/dref",
        {
            fields: {
                entryCount: 1
            },
            children: [urlNode]
        }
    );
}

export function registerDrefAssembler(registry) {
    registry.registerAssembler(
        "moov/trak/mdia/minf/dinf/dref",
        assembleDref
    );
}
