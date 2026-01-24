/**
 * applyUdtaPolicy
 * ===============
 *
 * Container-level policy for MP4 user data (udta).
 *
 * This policy operates strictly within the Mp4BuildInput contract
 * defined by `createMp4FromInputs`.
 *
 * It does NOT define that contract.
 *
 * ---------------------------------------------------------------------------
 * Responsibility
 * ---------------------------------------------------------------------------
 *
 * Given the presence or absence of:
 *   - buildHints.udtaBytes
 *   - buildHints.encoderIdentity
 *
 * this policy produces a `udta` representation suitable for
 * consumption by the compiler and emitters.
 *
 * ---------------------------------------------------------------------------
 * Non-responsibilities
 * ---------------------------------------------------------------------------
 *
 * This policy does NOT:
 *   - parse existing metadata
 *   - inspect opaque bytes
 *   - merge multiple sources
 *   - invent container history
 *   - guess encoder intent
 *
 * ---------------------------------------------------------------------------
 * Possible outcomes (derived from upstream contract)
 * ---------------------------------------------------------------------------
 *
 *   - null
 *       → omit `udta` entirely
 *
 *   - opaque `udta` box node
 *       → preserve historical container bytes verbatim
 *
 *   - structured `udta` box node
 *       → emit semantic authorship metadata
 *
 * No other outcomes are permitted.
 */


/**
 * applyUdtaPolicy
 * ===============
 *
 * Container-level policy for MP4 user data (udta).
 *
 * This policy operates strictly within the Mp4BuildInput contract
 * defined by `createMp4FromInputs`.
 *
 * It does NOT define that contract.
 */


export function applyUdtaPolicy({
    opaqueUdta,
    encoderIdentity
}) {

    // ---------------------------------------------------------
    // Grammar enforcement — mutual exclusivity
    // ---------------------------------------------------------
    if (opaqueUdta !== undefined && encoderIdentity !== undefined) {
        throw new Error(
            "applyUdtaPolicy: opaqueUdta and encoderIdentity are mutually exclusive"
        );
    }

    // ---------------------------------------------------------
    // Case 1 — Opaque historical passthrough
    // ---------------------------------------------------------
    if (opaqueUdta !== undefined) {

        if (!(opaqueUdta instanceof Uint8Array)) {
            throw new Error(
                "applyUdtaPolicy: opaqueUdta must be Uint8Array"
            );
        }

        return {
            type: "udta",
            bytes: opaqueUdta
        };
    }

    // ---------------------------------------------------------
    // Case 2 — Explicit omission
    // ---------------------------------------------------------
    if (encoderIdentity === "") {
        return null;
    }

    // ---------------------------------------------------------
    // Case 3 — Semantic authorship declaration
    // ---------------------------------------------------------
    if (typeof encoderIdentity === "string") {

        // Encode encoder identity as UTF-8 payload
        const payload = new TextEncoder().encode(encoderIdentity);

        const data = emitDataBox({
            version: 0,
            flags: 0,
            dataType: 1,   // UTF-8 string
            locale: 0,
            payload
        });

        const ilstItem = emitIlstItemBox({
            type: "©too",
            data
        });

        const ilst = emitIlstBox({
            items: [ ilstItem ]
        });

        const hdlr = emitMetaHdlrBox({
            nameBytes: new TextEncoder().encode("mdir\0")
        });

        const meta = emitMetaBox({
            hdlr,
            ilst
        });

        return emitUdtaBox({
            children: [ meta ]
        });
    }

    // ---------------------------------------------------------
    // Case 4 — No udta input
    // ---------------------------------------------------------
    return null;
}
