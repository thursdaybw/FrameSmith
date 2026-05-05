/**
 * parseAudioSpecificConfigFromEsds
 * =================================
 *
 * OPTIONAL codec introspection utility.
 *
 * This function inspects opaque ESDS descriptor bytes and attempts to locate
 * an AudioSpecificConfig (ASC) descriptor, if present.
 *
 * Architectural role:
 * -------------------
 * - This is NOT a deriver.
 * - This is NOT a normalizer.
 * - This is NOT part of the compiler pipeline.
 *
 * It performs *optional observation* of codec-internal configuration.
 *
 * Absence of AudioSpecificConfig is LEGAL and EXPECTED.
 * Callers MUST treat a null result as a valid outcome.
 *
 * This function MUST NOT:
 * - enforce semantic invariants
 * - derive presentation fields (channels, sample rate, sample size)
 * - throw on absence of descriptors
 *
 * It MAY:
 * - throw on malformed ES descriptor encoding
 *
 * Input contract:
 * ---------------
 * - `esds` MUST be ES descriptor payload bytes
 * - NOT a full 'esds' box
 *
 * Output:
 * -------
 * - { audioObjectType, samplingFrequencyIndex, channelConfiguration }
 * - or null if AudioSpecificConfig is not present
 */

export function parseAudioSpecificConfigFromEsds({ esds }) {

    if (!(esds instanceof Uint8Array)) {
        throw new Error(
            "parseAudioSpecificConfigFromEsds: esds must be a Uint8Array"
        );
    }

    // ---------------------------------------------------------
    // Guard: reject full esds box bytes
    // ---------------------------------------------------------
    // size(4) + type(4) = 'esds'
    if (
        esds.length >= 8 &&
        esds[4] === 0x65 && // e
        esds[5] === 0x73 && // s
        esds[6] === 0x64 && // d
        esds[7] === 0x73    // s
    ) {
        throw new Error(
            "parseAudioSpecificConfigFromEsds: expected ES descriptor payload, " +
            "received full 'esds' box bytes. Header stripping must occur earlier."
        );
    }

    // ---------------------------------------------------------
    // Scan ES descriptor graph
    // ---------------------------------------------------------
    //
    // ESDS descriptor structure (simplified):
    //
    //   ES_Descriptor (0x03)
    //     DecoderConfigDescriptor (0x04)
    //       DecoderSpecificInfo (0x05)
    //         AudioSpecificConfig
    //
    // All descriptors use variable-length size encoding.
    //

    let offset = 0;

    while (offset < esds.length) {

        const tag = esds[offset++];

        // ---------------------------------------------
        // Decode variable-length size
        // ---------------------------------------------
        let size = 0;
        let shift = 0;

        while (true) {
            if (offset >= esds.length) {
                throw new Error(
                    "parseAudioSpecificConfigFromEsds: truncated size field"
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
                    "parseAudioSpecificConfigFromEsds: invalid size encoding"
                );
            }
        }

        // ---------------------------------------------
        // DecoderSpecificInfo (0x05) → AudioSpecificConfig
        // ---------------------------------------------
        if (tag === 0x05) {

            if (offset + size > esds.length) {
                throw new Error(
                    "parseAudioSpecificConfigFromEsds: DecoderSpecificInfo exceeds buffer"
                );
            }

            if (size < 2) {
                // AudioSpecificConfig must be at least 2 bytes
                return null;
            }

            const asc = esds.slice(offset, offset + size);

            const byte0 = asc[0];
            const byte1 = asc[1];

            const audioObjectType =
                (byte0 >> 3) & 0x1F;

            const samplingFrequencyIndex =
                ((byte0 & 0x07) << 1) | (byte1 >> 7);

            const channelConfiguration =
                (byte1 >> 3) & 0x0F;

            return {
                audioObjectType,
                samplingFrequencyIndex,
                channelConfiguration
            };
        }

        // ---------------------------------------------
        // Skip descriptor payload
        // ---------------------------------------------
        offset += size;
    }

    // ---------------------------------------------------------
    // AudioSpecificConfig not present (legal)
    // ---------------------------------------------------------
    return null;
}
