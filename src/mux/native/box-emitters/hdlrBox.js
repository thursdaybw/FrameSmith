/**
 * HDLR — Handler Reference Box
 * ---------------------------
 * Declares the *type of media* handled by a track.
 *
 * For video tracks:
 *   handler_type = "vide"
 *
 * The optional `name` field is a human-readable label only.
 * It has no semantic meaning for decoding, playback, or muxing.
 * Players and decoders ignore it entirely.
 *
 * Framesmith emits a canonical handler name to match reference
 * encoders and enable byte-for-byte conformance testing.
 *
 * External references:
 * - ISO/IEC 14496-12 — Handler Reference Box
 * - mp4ra.org registered boxes
 * - ffmpeg, mp4box.js reference output
 */
export function emitHdlrBox(params) {
    if (typeof params !== "object" || params === null) {
        throw new Error("emitHdlrBox: expected a parameter object");
    }

    const { handlerType, nameBytes } = params;

    if (typeof handlerType !== "string" || handlerType.length !== 4) {
        throw new Error(
            "emitHdlrBox: 'handlerType' must be a 4-character FourCC string"
        );
    }

    if (nameBytes !== null && !(nameBytes instanceof Uint8Array)) {
        throw new Error(
            "emitHdlrBox: 'nameBytes' must be Uint8Array or null"
        );
    }

    const effectiveNameBytes =
        nameBytes !== null
            ? nameBytes
            : new Uint8Array([0]);

    return {
        type: "hdlr",
        version: 0,
        flags: 0,

        body: [
            { int: 0 },                // pre_defined
            { type: handlerType },     // handler_type
            { int: 0 },                // reserved 1
            { int: 0 },                // reserved 2
            { int: 0 },                // reserved 3
            {
                array: "byte",
                values: Array.from(effectiveNameBytes)
            }
        ]
    };
}
