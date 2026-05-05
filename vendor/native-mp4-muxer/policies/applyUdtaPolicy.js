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
 * This policy produces **emit-ready intent**, not box nodes.
 * Emission is the responsibility of the compiler via EmitterRegistry.
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

        return {
            type: "udta",
            children: [
                {
                    type: "meta",
                    hdlr: {
                        handlerType: "mdir",
                        nameBytes: new TextEncoder().encode("mdir\0")
                    },
                    ilst: {
                        items: [
                            {
                                type: "©too",
                                data: {
                                    version: 0,
                                    flags: 0,
                                    dataType: 1,
                                    locale: 0,
                                    payload: new TextEncoder().encode(encoderIdentity)
                                }
                            }
                        ]
                    }
                }
            ]
        };
    }

    // ---------------------------------------------------------
    // Case 4 — No udta input
    // ---------------------------------------------------------
    return null;
}
