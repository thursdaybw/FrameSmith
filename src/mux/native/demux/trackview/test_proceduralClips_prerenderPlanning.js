/**
 * ProceduralClip → Pre-Render Planning Contract Tests
 *
 * WHAT IS UNDER TEST:
 * - Procedural clips participate in timeline planning
 * - Duration comes from clip bounds, not samples
 * - Procedural fragments are emitted deterministically
 */

import { __test__ } from "../../../../../../script.js";

import {
    PreRenderPlanFragmentKinds,
    PreRenderPlanContributorKinds
} from "../../../../timeline/planFragments.js";

import { ProceduralClip } from "../../../../timeline/ProceduralClip.js";

const {
    Timeline,
    Track,
    buildPrerenderPlanFromTimeline
} = __test__;

function assert(condition, message) {
    if (!condition) {
        throw new Error("ASSERTION FAILED: " + message);
    }
}

function getProceduralFragments(plan, proceduralKind) {
    return plan.fragments.filter(
        f =>
            f.kind === PreRenderPlanFragmentKinds.PROCEDURAL &&
            f.prerenderContributorKind ===
                PreRenderPlanContributorKinds.PROCEDURAL &&
            f.proceduralKind === proceduralKind
    );
}

async function test_singleProceduralClip_emitsFragment() {

    const clip = new ProceduralClip({
        kind: "text-overlays",
        startSeconds: 1,
        endSeconds: 4,
        items: [
            { text: "Hello World" }
        ]
    });

    const track = new Track();
    track.addClip(clip);

    const timeline = new Timeline();
    timeline.addTrack(track);

    const plan = buildPrerenderPlanFromTimeline({ timeline });

    const fragments = getProceduralFragments(plan, "text-overlays");

    assert(fragments.length === 1, "expected one procedural fragment");

    const fragment = fragments[0];

    assert(
        fragment.prerenderContributorKind ===
        PreRenderPlanContributorKinds.PROCEDURAL,
        "procedural fragment must declare procedural prerenderContributorKind"
    );

    assert(
        fragment.items.length === 1,
        "procedural fragment must contain items"
    );

    assert(
        fragment.items[0].clip === clip,
        "procedural item must preserve clip provenance"
    );
}


async function test_twoProceduralTracks_overlapInTime() {

    const clipA = new ProceduralClip({
        startSeconds: 0,
        endSeconds: 5,
        kind: "text-overlay",
        items: [{ text: "A" }]
    });

    const clipB = new ProceduralClip({
        startSeconds: 2,
        endSeconds: 6,
        kind: "image",
        items: [{ src: "logo.png" }]
    });

    const trackA = new Track();
    trackA.addClip(clipA);

    const trackB = new Track();
    trackB.addClip(clipB);

    const timeline = new Timeline();
    timeline.addTrack(trackA);
    timeline.addTrack(trackB);

    const plan = buildPrerenderPlanFromTimeline({ timeline });

    const proceduralFragments = plan.fragments.filter(
        f => f.kind === PreRenderPlanFragmentKinds.PROCEDURAL
    );

    assert(
        proceduralFragments.length >= 2,
        "expected procedural fragments from both tracks"
    );
}

async function test_overlappingProceduralClips_sameTrack() {

    const clipA = new ProceduralClip({
        startSeconds: 0,
        endSeconds: 5,
        kind: "text-overlay",
        items: [{ text: "First" }]
    });

    const clipB = new ProceduralClip({
        startSeconds: 3,
        endSeconds: 7,
        kind: "text-overlay",
        items: [{ text: "Second" }]
    });

    const track = new Track();
    track.addClip(clipA);
    track.addClip(clipB);

    const timeline = new Timeline();
    timeline.addTrack(track);

    const plan = buildPrerenderPlanFromTimeline({ timeline });

    const proceduralFragments = plan.fragments.filter(
        f => f.kind === PreRenderPlanFragmentKinds.PROCEDURAL
    );

    const items = proceduralFragments.flatMap(f => f.items);

    assert(
        items.length === 2,
        "expected both procedural clips to contribute items"
    );
}

async function test_singleImageOverlayClip_emitsProceduralFragment() {

    const clip = new ProceduralClip({
        kind: "image-overlay",
        startSeconds: 2,
        endSeconds: 6,
        items: [
            {
                src: "./logo.png",
                x: 0.03,
                y: 0.03,
                width: 0.30,
                height: null,
                animate: ["pulse"]
            }
        ]
    });

    const track = new Track();
    track.addClip(clip);

    const timeline = new Timeline();
    timeline.addTrack(track);

    const plan = buildPrerenderPlanFromTimeline({ timeline });

    const fragments = getProceduralFragments(plan, "image-overlay");

    assert(fragments.length === 1, "expected one image-overlay fragment");

    const fragment = fragments[0];

    assert(
        fragment.items.length === 1,
        "image-overlay fragment must contain one item"
    );

    const item = fragment.items[0];

    assert(item.src === "./logo.png", "image src must be preserved");
    assert(item.animate.includes("pulse"), "animation intent must be preserved");
    assert(item.startSeconds === 2, "startSeconds must be preserved");
    assert(item.endSeconds === 6, "endSeconds must be preserved");
}

async function test_singleImageProceduralClip_emitsFragment() {

    const clip = new ProceduralClip({
        kind: "image-overlays",
        startSeconds: 1,
        endSeconds: 4,
        items: [
            {
                src: "./logo.png",
                x: 0.03,
                y: 0.03,
                w: 0.30,
                h: null,
                animate: ["pulse"]
            }
        ]
    });

    const track = new Track();
    track.addClip(clip);

    const timeline = new Timeline();
    timeline.addTrack(track);

    const plan = buildPrerenderPlanFromTimeline({ timeline });

    const fragments = getProceduralFragments(plan, "image-overlays");

    assert(fragments.length === 1, "expected one image procedural fragment");

    const fragment = fragments[0];

    assert(
        fragment.items.length === 1,
        "image procedural fragment must contain items"
    );

    assert(
        fragment.items[0].clip === clip,
        "image procedural item must preserve clip provenance"
    );
}

async function test_emptyTimeline_emitsNoFragments() {
    const timeline = new Timeline();

    const plan = buildPrerenderPlanFromTimeline({ timeline });

    assert(
        Array.isArray(plan.fragments),
        "plan.fragments must be an array"
    );

    assert(
        plan.fragments.length === 0,
        "empty timeline must emit no fragments"
    );
}

async function test_trackWithOnlyProceduralClips_emitsNoAccessUnitFragments() {

    const clip = new ProceduralClip({
        kind: "text-overlay",
        startSeconds: 0,
        endSeconds: 2,
        items: [{ text: "Hello" }]
    });

    const track = new Track();
    track.addClip(clip);

    const timeline = new Timeline();
    timeline.addTrack(track);

    const plan = buildPrerenderPlanFromTimeline({ timeline });

    const accessUnitFragments = plan.fragments.filter(
        f => f.kind === PreRenderPlanFragmentKinds.ACCESS_UNITS
    );

    assert(
        accessUnitFragments.length === 0,
        "track with only procedural clips must not emit access-unit fragments"
    );
}

async function test_proceduralClip_withNoItems_isRejected() {

    let threw = false;

    try {
        new ProceduralClip({
            kind: "text-overlay",
            startSeconds: 0,
            endSeconds: 2,
            items: []
        });
    } catch {
        threw = true;
    }

    assert(
        threw,
        "procedural clip with no items must be rejected at construction"
    );
}



export const PROCEDURAL_CLIP_TESTS = [
    test_singleProceduralClip_emitsFragment,
    test_twoProceduralTracks_overlapInTime,
    test_overlappingProceduralClips_sameTrack,
    test_singleImageOverlayClip_emitsProceduralFragment,
    test_singleImageProceduralClip_emitsFragment,
    test_emptyTimeline_emitsNoFragments,
    test_trackWithOnlyProceduralClips_emitsNoAccessUnitFragments,
    test_proceduralClip_withNoItems_isRejected,
];
