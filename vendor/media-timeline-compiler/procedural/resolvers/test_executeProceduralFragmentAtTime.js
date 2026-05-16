import {
    buildPrerenderPlanFromTimeline
} from "../../compileTimeline.js";

import { routeProceduralFragmentAtTimeToResolver } from "../routeProceduralFragmentAtTimeToResolver.js";

import { ProceduralClip } from "../../ProceduralClip.js";

import { Timeline } from "../../Timeline.js";
import { Track } from "../../Track.js";

function assert(condition, message) {
    if (!condition) {
        throw new Error("ASSERT FAILED: " + message);
    }
}

/**
 * Test — Procedural clip flows from Timeline to Renderer
 *
 * Locks:
 * - ProceduralClip authors payload
 * - Track discovery emits procedural plan fragment
 * - Fragment is executed via routeProceduralFragmentAtTimeToResolver
 * - Renderer receives original payload untouched
 */
export function test_proceduralClip_flowsFromTimelineIntoTimecodeIntentResolver() {

    // -------------------------------------------------
    // Procedural payload (real authoring data)
    // -------------------------------------------------

    const textOverlayPayload = {
        startSeconds: 0,
        endSeconds: 30,
        override: [],
        animate: [],
        words: [
            {
                start: 0,
                end: 30,
                text: "Hello",
                override: ["muted"],
                animate: []
            },
            {
                start: 0,
                end: 30,
                text: "World",
                override: [],
                animate: ["pulse"]
            }
        ]
    };

    // -------------------------------------------------
    // Timeline assembly (real domain objects)
    // -------------------------------------------------

    const timeline = new Timeline(30);
    const track = new Track();

    timeline.addTrack(track);

    const clip = new ProceduralClip({
        kind: "text-overlay",
        startSeconds: 0,
        endSeconds: 30,
        items: [ textOverlayPayload ]
    });

    track.addClip(clip);

    // -------------------------------------------------
    // Planning phase
    // -------------------------------------------------

    const prerenderPlan = buildPrerenderPlanFromTimeline({ timeline });

    const proceduralFragments = prerenderPlan.fragments.filter(
        f => f.prerenderContributorKind === "procedural"
    );

    assert(
        proceduralFragments.length === 1,
        "exactly one procedural fragment must be emitted"
    );

    const fragment = proceduralFragments[0];

    assert(
        fragment.proceduralKind === "text-overlay",
        "procedural fragment kind must match clip kind"
    );

    // -------------------------------------------------
    // Execution phase
    // -------------------------------------------------

    let receivedFragment = null;
    let receivedTime = null;

    const timecodeFragmentIntentResolvers = {
        "text-overlay": ({ fragment, timeSeconds }) => {
            receivedFragment = fragment;
            receivedTime = timeSeconds;
            return { videoFrames: [] };
        }
    };

    const t = 12;

    routeProceduralFragmentAtTimeToResolver({
        fragment,
        timeSeconds: t,
        timecodeFragmentIntentResolvers
    });

    // -------------------------------------------------
    // Assertions
    // -------------------------------------------------

    assert(receivedFragment !== null, "renderer must be called");
    assert(receivedTime === t, "renderer must receive correct time");

    assert(
        receivedFragment.items.length === 1,
        "renderer must receive one procedural item"
    );

    assert(
        receivedFragment.items[0] === textOverlayPayload,
        "renderer must receive original payload by reference"
    );
}


export function test_proceduralExecution_returnsRenderIntentsShape() {

    const fragment = {
        proceduralKind: "text-overlay",
        items: []
    };

    const resolver = {
        "text-overlay": () => ({
            renderIntents: [
                { kind: "text-overlay", test: true }
            ]
        })
    };

    const result = routeProceduralFragmentAtTimeToResolver({
        fragment,
        timeSeconds: 5,
        timecodeFragmentIntentResolvers: resolver
    });

    assert(
        Array.isArray(result.renderIntents),
        "procedural execution must return renderIntents array"
    );

    assert(
        result.renderIntents.length === 1,
        "renderIntents must propagate from resolver"
    );

    assert(
        result.videoFrames === undefined,
        "procedural execution must not emit videoFrames"
    );

    assert(
        result.audioFrames === undefined,
        "procedural execution must not emit audioFrames"
    );
}

export const PROCEDURAL_EXECUTION_TESTS = [
    test_proceduralClip_flowsFromTimelineIntoTimecodeIntentResolver,
    test_proceduralExecution_returnsRenderIntentsShape
];
