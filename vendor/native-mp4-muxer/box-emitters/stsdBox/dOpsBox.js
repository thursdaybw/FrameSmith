function emitDOpsBox(params) {

    if (params === null || typeof params !== "object") {
        throw new Error(
            "emitDOpsBox: parameter object is required.\n" +
            `Received: ${params === null ? "null" : typeof params}`
        );
    }

    const { payload, version, flags } = params;

    // ---------------------------------------------------------
    // payload
    // ---------------------------------------------------------
    if (!(payload instanceof Uint8Array)) {
        throw new Error(
            "emitDOpsBox: payload must be a Uint8Array.\n" +
            `Received: ${
                payload === undefined
                    ? "undefined"
                    : payload === null
                        ? "null"
                        : payload.constructor?.name || typeof payload
            }`
        );
    }

    if (payload.length === 0) {
        throw new Error(
            "emitDOpsBox: payload must be non-empty.\n" +
            "Received: Uint8Array(length=0)"
        );
    }

    // ---------------------------------------------------------
    // version
    // ---------------------------------------------------------
    if (!Number.isInteger(version)) {
        throw new Error(
            "emitDOpsBox: version must be an integer.\n" +
            `Received: ${version === undefined ? "undefined" : typeof version} (${String(version)})`
        );
    }

    // ---------------------------------------------------------
    // flags
    // ---------------------------------------------------------
    if (!Number.isInteger(flags)) {
        throw new Error(
            "emitDOpsBox: flags must be an integer.\n" +
            `Received: ${flags === undefined ? "undefined" : typeof flags} (${String(flags)})`
        );
    }

    return {
        type: "dOps",
        version,
        flags,

        opaqueFlags: true,

        body: [
            {
                array: "byte",
                values: Array.from(payload)
            }
        ]
    };
}

export function registerDOpsEmitter(registry) {
    registry.registerEmitter(
        "moov/trak/mdia/minf/stbl/stsd|Opus/dOps",
        emitDOpsBox
    );
}
