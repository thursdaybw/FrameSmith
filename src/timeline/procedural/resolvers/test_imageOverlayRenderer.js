import { resolveImageOverlayFragmentIntentAtTime } from "./resolvers/imageOverlayFragmentIntentResolver.js";

function assert(condition, message) {
    if (!condition) {
        throw new Error("ASSERT FAILED: " + message);
    }
}

export function test_imageOverlayRenderer_returnsStableShape() {
    const fragment = {
        proceduralKind: "image-overlay",
        items: [
            {
                startSeconds: 0,
                endSeconds: 10,
                pulse: {
                    largeScalePct: 35,
                    smallScalePct: 25,
                    cycleSeconds: 5
                }
            }
        ]
    };

    const t = 1;
    const result = resolveImageOverlayFragmentIntentAtTime({
        fragment,
        timeSeconds: t
    });

    assert(result && typeof result === "object", "resolver must return object");
    assert(Array.isArray(result.renderIntents), "renderIntents must be array");
    assert(result.renderIntents.length === 1, "resolver must emit exactly one render intent");

    const intent = result.renderIntents[0];
    assert(intent.kind === "image-overlay", "render intent kind must be image-overlay");
    assert(intent.fragment === fragment, "render intent must preserve fragment identity");
    assert(intent.timeSeconds === t, "render intent must preserve timeSeconds");
    assert(Array.isArray(intent.items), "image-overlay intent items must be array");
    assert(intent.items.length === 1, "image-overlay intent must contain one active item");
}

export function test_imageOverlayRenderer_pulseInterpolatesSmoothly() {
    const fragment = {
        proceduralKind: "image-overlay",
        items: [
            {
                startSeconds: 0,
                endSeconds: 10,
                pulse: {
                    largeScalePct: 35,
                    smallScalePct: 25,
                    cycleSeconds: 5
                }
            }
        ]
    };

    const atStart = resolveImageOverlayFragmentIntentAtTime({
        fragment,
        timeSeconds: 0
    });
    const atMidCycle = resolveImageOverlayFragmentIntentAtTime({
        fragment,
        timeSeconds: 2.5
    });
    const atQuarterCycle = resolveImageOverlayFragmentIntentAtTime({
        fragment,
        timeSeconds: 1.25
    });

    const startScale = atStart.renderIntents[0].items[0].animatedScalePct;
    const midCycleScale = atMidCycle.renderIntents[0].items[0].animatedScalePct;
    const quarterCycleScale = atQuarterCycle.renderIntents[0].items[0].animatedScalePct;

    assert(startScale === 35, "pulse should start at large scale");
    assert(midCycleScale === 25, "pulse should reach small scale at mid-cycle");
    assert(
        Math.abs(quarterCycleScale - 30) < 0.0001,
        "pulse should smoothly interpolate through midpoint scale"
    );
}

export const IMAGE_OVERLAY_RENDERER_TESTS = [
    test_imageOverlayRenderer_returnsStableShape,
    test_imageOverlayRenderer_pulseInterpolatesSmoothly
];
