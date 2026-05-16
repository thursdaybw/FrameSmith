import { applyUdtaPolicy } from "../policies/applyUdtaPolicy.js";

export function buildUdtaIntentFromBuildHints({ buildHints }) {

    if (!buildHints) {
        // No hints at all → default authorship
        return applyUdtaPolicy({
            encoderIdentity: "NativeMuxer alpha"
        });
    }

    // ---------------------------------------------------------
    // Case 1 — Structured udta supplied verbatim
    // ---------------------------------------------------------
    if (buildHints.udta !== undefined) {
        return buildHints.udta;
    }

    // ---------------------------------------------------------
    // Case 2 — Explicit omission
    // ---------------------------------------------------------
    if (buildHints.encoderIdentity === "") {
        return null;
    }

    // ---------------------------------------------------------
    // Case 3 — Explicit or default authorship
    // ---------------------------------------------------------
    return applyUdtaPolicy({
        opaqueUdta: buildHints.udtaBytes,
        encoderIdentity:
            buildHints.encoderIdentity ?? "NativeMuxer alpha"
    });
}
