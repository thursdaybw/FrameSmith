/**
 * META > HDLR — Metadata Handler Reference Box
 *
 * Ground truth (ffmpeg inspection):
 *
 * offset  bytes  meaning
 * 0       4      size = 33
 * 4       4      type = "hdlr"
 * 8       1      version = 0
 * 9       3      flags = 0
 * 12      4      zero padding
 * 16      4      handler_type = "mdir"
 * 20..32         name bytes + padding
 *
 * Total body length = 21 bytes
 */
export function emitMetaHdlrBox(params) {

    if (typeof params !== "object" || params === null) {
        throw new Error(
            "emitMetaHdlrBox: expected parameter object"
        );
    }

    const { nameBytes } = params;

    if (!(nameBytes instanceof Uint8Array)) {
        throw new Error(
            "emitMetaHdlrBox: 'nameBytes' must be Uint8Array"
        );
    }

    return {
        type: "hdlr",
        version: 0,
        flags: 0,

        body: [
            // zero padding (bytes 12..15)
            { int: 0 },

            // handler_type = "mdir" (bytes 16..19)
            { type: "mdir" },

            // name bytes + padding (bytes 20..)
            {
                array: "byte",
                values: Array.from(nameBytes)
            }
        ]
    };
}
