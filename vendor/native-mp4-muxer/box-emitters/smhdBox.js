/*hort
 * SMHD — Sound Media Header Box
 * ----------------------------
 *
 * Audio equivalent of vmhd.
 *
 * Declares basic playback balance information for an audio track.
 * Modern players ignore this value entirely, but the box is mandatory
 * for audio media per ISO/IEC 14496-12.
 *
 * Structure (version 0):
 * ----------------------
 * - balance  (int16, 8.8 fixed-point)
 * - reserved (uint16, must be 0)
 *
 * Framesmith emits the canonical ffmpeg-compatible form:
 * - balance = 0
 * - reserved = 0
 */
function emitSmhdBox({ balance = 0 } = {}) {

    if (!Number.isInteger(balance)) {
        throw new Error(
            "emitSmhdBox: balance must be an integer"
        );
    }

    return {
        type: "smhd",
        version: 0,
        flags: 0,

        body: [
            { short: balance }, // int16
            { short: 0 }        // uint16
        ]
    };
}

export function registerSmhdEmitter(registry) {
    registry.registerEmitter(
        "moov/trak/mdia/minf/smhd",
        emitSmhdBox
    );
}
