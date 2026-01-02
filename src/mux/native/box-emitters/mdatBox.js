/**
 * MDAT — Media Data Box
 *
 * Opaque payload container.
 *
 * Responsibilities:
 * - wrap provided media bytes in an MP4 box
 * - preserve payload verbatim
 *
 * Non-responsibilities:
 * - no chunking
 * - no offsets
 * - no parsing
 * - no policy
 * - no mutation
 */
export function emitMdatBox({ payload }) {

    if (!(payload instanceof Uint8Array)) {
        throw new Error(
            "emitMdatBox: payload must be a Uint8Array"
        );
    }

    return {
        type: "mdat",
        body: [
            { OpaqueBytesPassthrough: payload }
        ]
    };
}
