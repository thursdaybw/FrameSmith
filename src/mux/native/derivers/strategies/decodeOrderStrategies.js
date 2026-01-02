/**
 * DecodeOrderStrategies
 * ====================
 *
 * Decode order strategies define how decode timestamps (DTS)
 * are assigned to samples during structural derivation.
 *
 * This choice determines the decode timeline topology.
 */
export const DecodeOrderStrategies = {

    /**
     * DECODE_ORDER_EQUALS_SAMPLE_ORDER
     * --------------------------------
     *
     * Samples are decoded in the order they appear
     * in the access unit array.
     *
     * Effects:
     * - DTS is a monotonically increasing clock
     * - decode duration is uniform
     * - presentation reordering is handled via CTTS
     *
     * This strategy matches the structure produced
     * by ffmpeg for the reference MP4.
     */
    DECODE_ORDER_EQUALS_SAMPLE_ORDER:
        "decode-order-equals-sample-order"
};
