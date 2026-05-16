import { PROCEDURAL_EXECUTION_TESTS } from "./procedural/resolvers/test_executeProceduralFragmentAtTime.js";
import { TEXT_OVERLAY_RENDERER_TESTS } from "./procedural/resolvers/test_textOverlayRenderer.js";
import { IMAGE_OVERLAY_RENDERER_TESTS } from "./procedural/resolvers/test_imageOverlayRenderer.js";
import { CONTAINER_DECODE_TESTS } from "./container/execution/test_executeAccessUnitFragmentDecode.js";

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

const TIMELINE_NODE_TESTS = [
    ...PROCEDURAL_EXECUTION_TESTS,
    ...TEXT_OVERLAY_RENDERER_TESTS,
    ...IMAGE_OVERLAY_RENDERER_TESTS,
    ...CONTAINER_DECODE_TESTS
];

async function runTimelineNodeTests() {
    console.log(`Running media timeline compiler node tests (${TIMELINE_NODE_TESTS.length})`);

    let failures = 0;

    for (const testFn of TIMELINE_NODE_TESTS) {
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
        throw new Error(`Media timeline compiler tests completed with ${failures} failure(s)`);
    }

    console.log("ALL MEDIA TIMELINE COMPILER TESTS PASSED");
}

runTimelineNodeTests().catch((error) => {
    console.error(error);
    process.exit(1);
});
