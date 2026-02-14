/**
 * FrameSmith — Timeline → Pre-Render Planning Contract Tests
 *
 * WHAT THIS FILE IS:
 * ------------------
 * These tests define and lock the contract between:
 *
 *   Timeline compilation
 *   →
 *   Pre-render plan generation
 *
 * This file does NOT test TrackViews directly.
 * TrackViews are used only as fixtures to supply deterministic access units.
 *
 * WHAT IS UNDER TEST:
 * -------------------
 * - Pre-render PLAN FRAGMENTS
 * - Fragment presence, shape, and semantics
 * - Deterministic ordering of access units
 * - Clip boundary enforcement
 *
 * WHAT IS EXPLICITLY OUT OF SCOPE:
 * -------------------------------
 * - Decoding
 * - Rendering
 * - Playback
 * - Frame generation
 * - Audio sample generation
 *
 * ARCHITECTURAL INVARIANTS (DO NOT BREAK):
 * ---------------------------------------
 * - Planning produces PLAN FRAGMENTS, not media data.
 * - Access units appear ONLY inside access-unit fragments.
 * - Fragment identity is explicit and constructor-owned.
 * - Planning is deterministic and side-effect free.
 *
 * If any of these invariants change, this file MUST be updated first.
 */
import { createContainerTrackViewFromMp4 } from "./createContainerTrackViewFromMp4.js";
import { __test__ } from "../../../../../script.js";

import {
    PreRenderPlanFragmentKinds,
    PreRenderPlanContributorKinds
} from "../../../../timeline/planFragments.js";

const {
    Timeline,
    Track,
    Clip,
    buildPrerenderPlanFromTimeline
} = __test__;

// ------------------------------------------------------------
// Utilities
// ------------------------------------------------------------

function assert(condition, message) {
    if (!condition) {
        throw new Error("ASSERTION FAILED: " + message);
    }
}

function deepEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

async function loadTestMp4() {
    const resp = await fetch("./test.mp4");
    const bytes = new Uint8Array(await resp.arrayBuffer());
    return bytes;
}

function getAccessUnitFragment(plan) {
    const fragment = plan.fragments.find(
        f => f.kind === PreRenderPlanFragmentKinds.ACCESS_UNITS
    );

    assert(
        fragment,
        "Missing access-units fragment"
    );

    assert(
        fragment.prerenderContributorKind ===
            PreRenderPlanContributorKinds.CONTAINER_TRACK,
        "access-units fragment must declare container-track prerenderContributorKind"
    );

    return fragment;
}

function resolveFullTrackRangeSeconds(trackView) {
    const samples = Array.isArray(trackView?._semanticSamples)
        ? trackView._semanticSamples
        : [];
    assert(samples.length > 0, "track must have semantic samples");

    let minPts = Number.POSITIVE_INFINITY;
    let maxInclusiveEndPts = Number.NEGATIVE_INFINITY;

    for (const sample of samples) {
        const pts = Number(sample?.pts);
        if (!Number.isFinite(pts)) continue;
        if (pts < minPts) minPts = pts;

        const duration = Number(sample?.duration);
        const endPts = pts + (Number.isFinite(duration) && duration > 0 ? duration : 1);
        if (endPts > maxInclusiveEndPts) {
            maxInclusiveEndPts = endPts;
        }
    }

    assert(Number.isFinite(minPts), "track must expose finite sample pts values");
    assert(Number.isFinite(maxInclusiveEndPts), "track must expose finite sample end values");

    return {
        startSeconds: trackView.ptsToSeconds(minPts),
        endSeconds: trackView.ptsToSeconds(maxInclusiveEndPts)
    };
}

// ------------------------------------------------------------
// Test 1: Single clip, full track
// ------------------------------------------------------------

async function test_singleClip_fullTrack() {

    const mp4Bytes = await loadTestMp4();
    const videoTrackView = createContainerTrackViewFromMp4({
        mp4Bytes,
        trackIndex: 0
    });

    const fullRange = resolveFullTrackRangeSeconds(videoTrackView);
    const clip = new Clip({
        trackView: videoTrackView,
        startSeconds: fullRange.startSeconds,
        endSeconds: fullRange.endSeconds
    });

    const track = new Track();
    track.addClip(clip);

    const timeline = new Timeline();
    timeline.addTrack(track);

    const plan = buildPrerenderPlanFromTimeline({ timeline });
    const fragment = getAccessUnitFragment(plan);

    assert(
        fragment.access_units.length === videoTrackView.sampleCount,
        "unit count must match container sample count"
    );

    assert(
        fragment.access_units[0].pts === videoTrackView._semanticSamples[0].pts,
        "first PTS must match container"
    );

    assert(
        fragment.access_units.at(-1).pts === videoTrackView._semanticSamples.at(-1).pts,
        "last PTS must match container"
    );
}

// ------------------------------------------------------------
// Test 2: Clip trimming
// ------------------------------------------------------------

async function test_clipTrimming() {

    const mp4Bytes = await loadTestMp4();
    const videoTrackView = createContainerTrackViewFromMp4({
        mp4Bytes,
        trackIndex: 0
    });

    const startSeconds = 2;
    const endSeconds = 5;

    const clip = new Clip({
        trackView: videoTrackView,
        startSeconds,
        endSeconds
    });

    const track = new Track();
    track.addClip(clip);

    const timeline = new Timeline();
    timeline.addTrack(track);

    const plan = buildPrerenderPlanFromTimeline({ timeline });
    const fragment = getAccessUnitFragment(plan);

    const startPts = videoTrackView.secondsToPts(startSeconds);
    const endPts   = videoTrackView.secondsToPts(endSeconds);

    for (const unit of fragment.access_units) {
        assert(unit.pts >= startPts, "PTS below clip start");
        assert(unit.pts <= endPts, "PTS above clip end");
    }
}

// ------------------------------------------------------------
// Test 3: Multiple clips, same track (no interleaving)
// ------------------------------------------------------------

async function test_multipleClips_sameTrack() {

    const mp4Bytes = await loadTestMp4();
    const videoTrackView = createContainerTrackViewFromMp4({
        mp4Bytes,
        trackIndex: 0
    });

    const clipA = new Clip({
        trackView: videoTrackView,
        startSeconds: 0,
        endSeconds: 2
    });

    const clipB = new Clip({
        trackView: videoTrackView,
        startSeconds: 5,
        endSeconds: 7
    });

    const track = new Track();
    track.addClip(clipA);
    track.addClip(clipB);

    const timeline = new Timeline();
    timeline.addTrack(track);

    const plan = buildPrerenderPlanFromTimeline({ timeline });
    const fragment = getAccessUnitFragment(plan);

    let seenClipB = false;

    for (const unit of fragment.access_units) {
        if (unit.clip === clipB) seenClipB = true;

        if (seenClipB) {
            assert(
                unit.clip === clipB,
                "Clip B units must not interleave with Clip A"
            );
        }
    }
}

// ------------------------------------------------------------
// Test 4: Audio + Video symmetry (fragment presence)
// ------------------------------------------------------------

async function test_audioVideoSymmetry() {

    const mp4Bytes = await loadTestMp4();

    const videoView = createContainerTrackViewFromMp4({
        mp4Bytes,
        trackIndex: 0
    });

    const audioView = createContainerTrackViewFromMp4({
        mp4Bytes,
        trackIndex: 1
    });

    const videoClip = new Clip({
        trackView: videoView,
        startSeconds: 0,
        endSeconds: 3
    });

    const audioClip = new Clip({
        trackView: audioView,
        startSeconds: 0,
        endSeconds: 3
    });

    const videoTrack = new Track();
    const audioTrack = new Track();

    videoTrack.addClip(videoClip);
    audioTrack.addClip(audioClip);

    const timeline = new Timeline();
    timeline.addTrack(videoTrack);
    timeline.addTrack(audioTrack);

    const plan = buildPrerenderPlanFromTimeline({ timeline });

    const accessUnitFragments = plan.fragments.filter(
        f => f.kind === PreRenderPlanFragmentKinds.ACCESS_UNITS
    );

    assert(
        accessUnitFragments.length >= 2,
        "expected access-units fragments for both video and audio tracks"
    );

    for (const fragment of accessUnitFragments) {
        assert(
            fragment.access_units.length > 0,
            "access-units fragment must not be empty"
        );
    }
}

// ------------------------------------------------------------
// Test 5: Determinism (non-negotiable)
// ------------------------------------------------------------

async function test_determinism() {

    const mp4Bytes = await loadTestMp4();
    const videoTrackView = createContainerTrackViewFromMp4({
        mp4Bytes,
        trackIndex: 0
    });

    const clip = new Clip({
        trackView: videoTrackView,
        startSeconds: 1,
        endSeconds: 4
    });

    const track = new Track();
    track.addClip(clip);

    const timeline = new Timeline();
    timeline.addTrack(track);

    const planA = buildPrerenderPlanFromTimeline({ timeline });
    const planB = buildPrerenderPlanFromTimeline({ timeline });

    const unitsA = getAccessUnitFragment(planA).access_units;
    const unitsB = getAccessUnitFragment(planB).access_units;

    assert(
        deepEqual(
            unitsA.map(u => u.pts),
            unitsB.map(u => u.pts)
        ),
        "PTS sequences must be identical"
    );
}

// ------------------------------------------------------------
// Runner export
// ------------------------------------------------------------

export const TRACKVIEW_TESTS = [
    test_singleClip_fullTrack,
    test_clipTrimming,
    test_multipleClips_sameTrack,
    test_audioVideoSymmetry,
    test_determinism
];
