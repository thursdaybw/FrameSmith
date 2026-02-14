import { PRERENDER_DECODE_CONTAINER_VIDEO_TESTS } from "./src/prerender/test_decodeContainerAccessUnits_containerVideo.js";
import { PRERENDER_DECODE_CONTAINER_AUDIO_TESTS } from "./src/prerender/test_decodeContainerAccessUnits_containerAudio.js";
import { MEDIA_ELEMENT_DECODE_PORT_TESTS } from "./src/prerender/decodePorts/test_createMediaElementDecodePort.js";
import {
    PRERENDER_DECODE_CONTAINER_ACCESS_UNITS_DISPATCH_TESTS
} from "./src/prerender/test_decodeContainerAccessUnitsFromPreRenderPlan_ignoresProceduralFragments.js";
import {
    PRERENDER_DECODE_CONTAINER_ACCESS_UNITS_EMPTY_PLAN_TESTS
} from "./src/prerender/test_decodeContainerAccessUnitsFromPreRenderPlan_noAccessUnits.js";
import {
    PRERENDER_DECODE_CONTAINER_ACCESS_UNITS_ORDER_TESTS
} from "./src/prerender/test_decodeContainerAccessUnitsFromPreRenderPlan_preservesDecoderOrder.js";
import { PRERENDER_DECODE_CONTAINER_ACCESS_UNITS_DETERMINISM_TESTS } from "./src/prerender/test_decodeContainerAccessUnitsFromPreRenderPlan_determinism.js";
import { PRERENDER_TIME_RESOLUTION_TESTS } from "./src/prerender/test_resolveProceduralFragmentsAtTimeFromPlan.js";
import { EXPORT_EXECUTION_STRATEGY_TESTS } from "./src/prerender/strategies/test_ExportExecutionStrategy.js";
import { PROCEDURAL_EXECUTION_TESTS } from "./src/timeline/procedural/resolvers/test_executeProceduralFragmentAtTime.js";
import { TEXT_OVERLAY_RENDERER_TESTS } from "./src/timeline/procedural/resolvers/test_textOverlayRenderer.js";
import { IMAGE_OVERLAY_RENDERER_TESTS } from "./src/timeline/procedural/resolvers/test_imageOverlayRenderer.js";
import { CONTAINER_DECODE_TESTS } from "./src/timeline/container/execution/test_executeAccessUnitFragmentDecode.js";
import { COMPOSITION_TESTS } from "./src/composition/test_composeAtTime.js";
import { ENCODE_TESTS } from "./src/encode/test_encodeAtTime.js";
import { EXPORT_ADAPTER_TESTS } from "./src/export/test_adaptEncodedOutputsToMp4BuildInput.js";
import { INTEGRATION_TESTS } from "./src/integration/test_FrameSmith_PublicApi_EndToEnd_ExportExecutionStrategy.js";

const COLORS = {
    blue: "\x1b[34m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    gray: "\x1b[90m",
    reset: "\x1b[0m"
};

function log(color, label, name) {
    console.log(`${COLORS[color]}${label}${COLORS.reset} ${COLORS.gray}${name}${COLORS.reset}`);
}

const SKIPPED_BROWSER_ONLY_MODULES = [
    "./src/mux/native/demux/trackview/test_createContainerTrackViewFromMp4.js",
    "./src/mux/native/demux/trackview/test_proceduralClips_prerenderPlanning.js",
    "./test_script.js script-local tests (imports ./script.js + DOM bootstrapping)"
];

const NODE_TESTS = [
    ...PRERENDER_DECODE_CONTAINER_VIDEO_TESTS,
    ...PRERENDER_DECODE_CONTAINER_AUDIO_TESTS,
    ...MEDIA_ELEMENT_DECODE_PORT_TESTS,
    ...PRERENDER_DECODE_CONTAINER_ACCESS_UNITS_DISPATCH_TESTS,
    ...PRERENDER_DECODE_CONTAINER_ACCESS_UNITS_EMPTY_PLAN_TESTS,
    ...PRERENDER_DECODE_CONTAINER_ACCESS_UNITS_ORDER_TESTS,
    ...PRERENDER_DECODE_CONTAINER_ACCESS_UNITS_DETERMINISM_TESTS,
    ...PRERENDER_TIME_RESOLUTION_TESTS,
    ...EXPORT_EXECUTION_STRATEGY_TESTS,
    ...PROCEDURAL_EXECUTION_TESTS,
    ...TEXT_OVERLAY_RENDERER_TESTS,
    ...IMAGE_OVERLAY_RENDERER_TESTS,
    ...CONTAINER_DECODE_TESTS,
    ...COMPOSITION_TESTS,
    ...ENCODE_TESTS,
    ...EXPORT_ADAPTER_TESTS,
    ...INTEGRATION_TESTS
];

async function runNodeTests() {
    console.log(`Running Node harness tests (${NODE_TESTS.length})`);
    console.log("Skipped browser-only modules:");
    for (const skipped of SKIPPED_BROWSER_ONLY_MODULES) {
        console.log(`  - ${skipped}`);
    }

    let failures = 0;

    for (const testFn of NODE_TESTS) {
        const name = testFn.name || "<anonymous test>";
        log("blue", "RUN ", name);
        try {
            const result = testFn();
            if (result instanceof Promise) {
                await result;
            }
            log("green", "PASS", name);
        } catch (error) {
            failures += 1;
            log("red", "FAIL", name);
            console.error(error);
        }
    }

    if (failures > 0) {
        throw new Error(`Node harness completed with ${failures} failure(s)`);
    }

    console.log("ALL NODE TESTS PASSED");
}

runNodeTests().catch((error) => {
    console.error(error);
    process.exit(1);
});
