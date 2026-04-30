/**
 * DecodedContainerBackedFragmentBatch
 *
 * Output of container-fragment batch decoding.
 *
 * This object contains decoded, raw media artifacts
 * produced by decompressing container-backed ACCESS_UNITS
 * fragments from a PreRenderPlan.
 *
 * Semantics:
 * - All container-backed fragments in the plan have been decoded.
 * - Decoded video frames and decoded audio data are returned in input order.
 * - No procedural fragments are represented here.
 *
 * This object represents a batch decode pass.
 * It is not time-scoped.
 *
 * IMPORTANT:
 * - This is NOT compressed media.
 * - This is NOT muxer input.
 * - This is NOT preview state.
 * - This is NOT a composed frame.
 *
 * It is a boundary object between:
 *
 *   Container Decode (decompression)
 *        →
 *   Composition / Rendering
 *
 * The compositor consumes raw frames from this object
 * together with time-scoped procedural render intents.
 */
export class DecodedContainerBackedFragmentBatch {
    constructor({
        decodedVideoFrames = [],
        decodedAudioData = []
    } = {}) {
        this.decodedVideoFrames = decodedVideoFrames;
        this.decodedAudioData = decodedAudioData;
    }
}
