import { getGoldenTruthBox }
    from "../goldenTruthExtractors/index.js";

/**
 * extractOpaqueUserDataFromMp4UsingRootContainer
 * =============================================
 *
 * Boundary adapter.
 *
 * Extracts the raw, opaque `udta` box bytes from the MP4 root
 * container, if present.
 *
 * This function:
 * - performs NO semantic interpretation
 * - performs NO container policy
 * - does NOT expose extractor internals
 * - returns raw bytes ONLY
 *
 * Absence of `udta` is NOT an error.
 *
 * @param {Object} params
 * @param {Uint8Array} params.mp4Bytes
 *
 * @returns {Uint8Array | undefined}
 */
export function
extractOpaqueUserDataFromMp4UsingRootContainer({
    mp4Bytes
}) {

    if (!(mp4Bytes instanceof Uint8Array)) {
        throw new Error(
            "extractOpaqueUserDataFromMp4UsingRootContainer: mp4Bytes must be Uint8Array"
        );
    }

    let report;

    try {
        report =
            getGoldenTruthBox
                .getSemanticBoxDataByPathFromMp4File(
                    mp4Bytes,
                    "moov/udta"
                )
                .readBoxReport();
    } catch (err) {
        // Absence of udta is allowed and expected.
        return undefined;
    }

    const raw = report?.raw;

    if (!(raw instanceof Uint8Array)) {
        throw new Error(
            "extractOpaqueUserDataFromMp4UsingRootContainer: udta present but invalid"
        );
    }

    return raw;
}
