import { decodeContainerAccessUnitsFromPreRenderPlanBatch } from "../decodeContainerAccessUnitsFromPreRenderPlanBatch.js";

export function createContainerWebCodecsDecodePort({
    videoDecoder,
    audioDecoder
} = {}) {
    return {
        async decodeRange({ plan, exportRange }) {
            return decodeContainerAccessUnitsFromPreRenderPlanBatch({
                plan,
                videoDecoder,
                audioDecoder,
                exportRange
            });
        }
    };
}
