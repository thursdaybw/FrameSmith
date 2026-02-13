import { resolveTextOverlayFragmentIntentAtTime } from "./resolvers/textOverlayFragmentIntentResolver.js";

function assert(condition, message) {
    if (!condition) {
        throw new Error("ASSERT FAILED: " + message);
    }
}

export function test_textOverlayRenderer_returnsStableShape() {

    const fragment = {
        proceduralKind: "text-overlay",
        items: [
            {
                startSeconds: 0,
                endSeconds: 30,
                words: [
                    { start: 0, end: 10, text: "Hello" },
                    { start: 10, end: 30, text: "World" }
                ]
            }
        ]
    };

    const t = 12;

    const result = resolveTextOverlayFragmentIntentAtTime({
        fragment,
        timeSeconds: t
    });

    assert(result && typeof result === "object", "resolver must return object");

    assert(
        Array.isArray(result.renderIntents),
        "resolver must return renderIntents array"
    );

    assert(
        result.renderIntents.length === 1,
        "resolver must emit exactly one render intent"
    );

    const intent = result.renderIntents[0];

    assert(
        intent.kind === "text-overlay",
        "render intent kind must be text-overlay"
    );

    assert(
        intent.fragment === fragment,
        "render intent must preserve fragment identity by reference"
    );

    assert(
        intent.timeSeconds === t,
        "render intent must preserve timeSeconds"
    );
}

export function test_textOverlayRenderer_filtersWordsByTime() {

    const fragment = {
        proceduralKind: "text-overlay",
        items: [
            {
                startSeconds: 0,
                endSeconds: 10,
                words: [
                    { start: 0, end: 3, text: "Hello" },
                    { start: 3, end: 6, text: "Beautiful" },
                    { start: 6, end: 9, text: "World" }
                ]
            }
        ]
    };

    // time inside "Beautiful"
    const result = resolveTextOverlayFragmentIntentAtTime({
        fragment,
        timeSeconds: 4
    });

    if (!Array.isArray(result.renderIntents)) {
        throw new Error("renderIntents must be array");
    }

    if (result.renderIntents.length !== 1) {
        throw new Error("exactly one render intent expected");
    }

    const words = result.renderIntents[0].items[0].words;

    if (words.length !== 1) {
        throw new Error("exactly one word must be active");
    }

    if (words[0].text !== "Beautiful") {
        throw new Error("active word must be 'Beautiful'");
    }
}

export const TEXT_OVERLAY_RENDERER_TESTS = [
    test_textOverlayRenderer_returnsStableShape,
    test_textOverlayRenderer_filtersWordsByTime
];
