/**
 * executeAccessUnitFragmentDecode
 *
 * Responsibility:
 * - Decode a container-backed access-unit fragment
 * - Emit VideoFrame / AudioData in strict input order
 *
 * This function does NOT:
 * - Compose
 * - Reorder
 * - Transform
 * - Interpret geometry or opacity
 *
 * Determinism:
 * - Output order exactly matches access unit order
 */
export async function executeAccessUnitFragmentDecode({ fragment, videoDecoder, audioDecoder }) {

    if (!fragment || !Array.isArray(fragment.accessUnits)) {
        throw new Error(
            "executeAccessUnitFragmentDecode: fragment.accessUnits required"
        );
    }

    const videoFrames = [];
    const audioFrames = [];

    for (const unit of fragment.accessUnits) {
        if (unit.type === "video") {
            const frames = await videoDecoder.decode(unit);
            videoFrames.push(...frames);
        } else if (unit.type === "audio") {
            const frames = await audioDecoder.decode(unit);
            audioFrames.push(...frames);
        } else {
            throw new Error(
                `executeAccessUnitFragmentDecode: unknown access unit type ${unit.type}`
            );
        }
    }

    return { videoFrames, audioFrames };
}
