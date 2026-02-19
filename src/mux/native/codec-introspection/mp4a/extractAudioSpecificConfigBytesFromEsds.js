/**
 * extractAudioSpecificConfigBytesFromEsds
 * =======================================
 *
 * Test-side semantic helper. It inspects raw ES descriptor bytes emitted by
 * WebCodecs or other encoders and extracts the inner AudioSpecificConfig
 * payload, if present.
 *
 * Architectural notes:
 * --------------------
 * - Not part of the compiler pipeline.
 * - Does not enforce codec or container invariants.
 * - Maintains the descriptor graph exactly as provided.
 * - Returns raw ASC payload bytes only.
 *
 * Input contract:
 * ---------------
 * - `esds` must be the decoder descriptor payload bytes (NOT a full `esds`
 *   box with headers).
 * - The function may throw if descriptor encoding is malformed.
 *
 * Output:
 * -------
 * - Returns a fresh `Uint8Array` containing the AudioSpecificConfig bytes when
 *   DecoderSpecificInfo (tag `0x05`) is encountered.
 * - Returns `null` when no such descriptor exists.
 *
 * The implementation performs a pure descriptor scan; it does not interpret
 * object types, channels, sampling frequencies, or any container structure.
 */
export function extractAudioSpecificConfigBytesFromEsds({ esds }) {

    if (!(esds instanceof Uint8Array)) {
        throw new Error("extractAudioSpecificConfigBytesFromEsds: esds must be a Uint8Array");
    }

    if (
        esds.length >= 8 &&
        esds[4] === 0x65 &&
        esds[5] === 0x73 &&
        esds[6] === 0x64 &&
        esds[7] === 0x73
    ) {
        throw new Error(
            "extractAudioSpecificConfigBytesFromEsds: expected ES descriptor payload, " +
            "received full 'esds' box bytes. Header stripping must occur earlier."
        );
    }

    let offset = 0;

    while (offset < esds.length) {
        const tag = esds[offset++];

        let size = 0;
        let shift = 0;

        while (true) {
            if (offset >= esds.length) {
                throw new Error(
                    "extractAudioSpecificConfigBytesFromEsds: truncated size field"
                );
            }

            const b = esds[offset++];
            size = (size << 7) | (b & 0x7F);

            if ((b & 0x80) === 0) {
                break;
            }

            shift += 7;
            if (shift > 28) {
                throw new Error(
                    "extractAudioSpecificConfigBytesFromEsds: invalid size encoding"
                );
            }
        }

        if (offset + size > esds.length) {
            throw new Error(
                "extractAudioSpecificConfigBytesFromEsds: descriptor payload exceeds buffer"
            );
        }

        if (tag === 0x05) {
            const ascStart = offset;
            const ascEnd = offset + size;
            return new Uint8Array(esds.subarray(ascStart, ascEnd));
        }

        offset += size;
    }

    return null;
}
