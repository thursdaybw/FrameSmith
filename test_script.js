/**
 * script.js – Timeline Planning Helper Tests
 *
 * These tests lock the CURRENT behavior of the helper functions exported
 * from script.js while the architecture is still in flux.
 *
 * What is under test:
 * - Timeline
 * - Track
 * - Clip
 * - buildDemoAccessUnitPlanFragmentForVideoTrack (legacy helper)
 * - buildDemoAccessUnitPlanFragmentForAudioTrack (legacy helper, optional audio)
 *
 * What is explicitly NOT under test:
 * - Demux correctness
 * - Decode correctness
 * - Rendering
 * - Playback
 * - Cross-track ordering / interleaving semantics
 *
 * Important:
 * - Any “requires video” behavior here is a property of the current demo helpers
 *   (e.g. buildDemoAccessUnitPlanFragmentForVideoTrack throws when no video track exists).
 * - This file does not declare FrameSmith domain invariants.
 */

/**
 * IMPORTANT NON-GOALS (BY DESIGN)
 *
 * These tests intentionally do NOT define:
 *
 * - Ordering or interleaving semantics between different tracks
 *   (e.g. audio vs video vs procedural tracks).
 *
 * - Cross-track temporal alignment or merge behavior.
 *
 * - How multiple tracks are combined into a single execution stream.
 *
 * The timeline compiler at this stage operates on ONE TRACK AT A TIME.
 * Any cross-track coordination is the responsibility of later stages
 * (pre-render execution, decode, or render graph orchestration).
 *
 * If multi-track ordering becomes required, it MUST be introduced
 * explicitly with new tests and a new abstraction.
 */

import { __test__ } from "./script.js";

import { TRACKVIEW_TESTS } from "./src/mux/native/demux/trackview/test_createContainerTrackViewFromMp4.js";

import { PROCEDURAL_CLIP_TESTS } from "./src/mux/native/demux/trackview/test_proceduralClips_prerenderPlanning.js";

import { PRERENDER_DECODE_CONTAINER_VIDEO_TESTS } from "./src/prerender/test_decodeContainerAccessUnits_containerVideo.js";
import { PRERENDER_DECODE_CONTAINER_AUDIO_TESTS } from "./src/prerender/test_decodeContainerAccessUnits_containerAudio.js";
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

import { PROCEDURAL_EXECUTION_TESTS } from "./src/timeline/procedural/resolvers/test_executeProceduralFragmentAtTime.js";
import { TEXT_OVERLAY_RENDERER_TESTS } from "./src/timeline/procedural/resolvers/test_textOverlayRenderer.js";
import { CONTAINER_DECODE_TESTS } from "./src/timeline/container/execution/test_executeAccessUnitFragmentDecode.js";

import { PRERENDER_TIME_RESOLUTION_TESTS } from "./src/prerender/test_resolveProceduralFragmentsAtTimeFromPlan.js";
import { INTEGRATION_TESTS } from "./src/integration/test_FrameSmith_PublicApi_EndToEnd_ExportExecutionStrategy.js";
import { COMPOSITION_TESTS } from "./src/composition/test_composeAtTime.js";
import { ENCODE_TESTS } from "./src/encode/test_encodeAtTime.js";
import { EXPORT_ADAPTER_TESTS } from "./src/export/test_adaptEncodedOutputsToMp4BuildInput.js";
import { EXPORT_EXECUTION_STRATEGY_TESTS } from "./src/prerender/strategies/test_ExportExecutionStrategy.js";

const {
    Timeline,
    Track,
    Clip,
    buildAccessUnitPlanFragmentFromTrack,
    buildPrerenderPlanFromTimeline
} = __test__;

// -------------------------------------------------
// Test utilities
// -------------------------------------------------

function assert(cond, msg) {
    if (!cond) throw new Error("ASSERT FAILED: " + msg);
}

function makeStubTrackView({ ptsList, timescale = 1_000_000 }) {
    return {
        containerMeta: { trackTimescale: timescale },

        secondsToPts(sec) {
            return Math.round(sec * timescale);
        },

        *iterateSamplesByPtsRange(startPts, endPts) {
            for (const pts of ptsList) {
                if (pts < startPts) continue;
                if (pts > endPts) break;

                yield {
                    pts,
                    dts: pts,
                    duration: 33_333,
                    isKey: true,
                    data: new Uint8Array([1, 2, 3])
                };
            }
        }
    };
}

function makeEmptyTimeline() {
    return new Timeline(10);
}

function makeMinimalVideoTimeline() {
    const trackView = {
        secondsToPts: s => s * 1_000_000,
        *iterateSamplesByPtsRange() {
            yield {
                pts: 0,
                dts: 0,
                duration: 33_333,
                isKeyframe: true,
                data: new Uint8Array([1])
            };
        }
    };

    const clip = new Clip({
        trackView,
        startSeconds: 0,
        endSeconds: 1
    });

    const track = new Track("video");
    track.addClip(clip);

    const timeline = new Timeline(1);
    timeline.addTrack(track);

    return timeline;
}

function test_singleClip_fullTrack() {
    const trackView = makeStubTrackView({
        ptsList: [0, 1_000_000, 2_000_000, 3_000_000]
    });

    const clip = new Clip({
        trackView,
        startSeconds: 0,
        endSeconds: 3
    });

    const track = new Track("video");
    track.addClip(clip);

    const timeline = new Timeline();
    timeline.addTrack(track);

    const fragment = buildAccessUnitPlanFragmentFromTrack({ track: timeline.tracks[0] });

    const plan = fragment.access_units;

    assert(plan.length === 4, "should emit all access units");
}

function test_clip_trimming() {
    const trackView = makeStubTrackView({
        ptsList: [0, 1_000_000, 2_000_000, 3_000_000]
    });

    const clip = new Clip({
        trackView,
        startSeconds: 1,
        endSeconds: 2
    });

    const track = new Track("video");
    track.addClip(clip);

    const timeline = new Timeline();
    timeline.addTrack(track);

    const fragment = buildAccessUnitPlanFragmentFromTrack({ track: timeline.tracks[0] });

    const plan = fragment.access_units;

    assert(plan.length === 2, "trimmed clip should emit only in-range units");
    assert(plan[0].pts === 1_000_000, "first pts must match clip start");
}

function test_multiple_clips_same_track() {
    const trackView = makeStubTrackView({
        ptsList: [0, 1, 2, 3, 4, 5].map(x => x * 1_000_000)
    });

    const clipA = new Clip({ trackView, startSeconds: 0, endSeconds: 1 });
    const clipB = new Clip({ trackView, startSeconds: 4, endSeconds: 5 });

    const track = new Track("video");
    track.addClip(clipA);
    track.addClip(clipB);

    const timeline = new Timeline();
    timeline.addTrack(track);

    const fragment = buildAccessUnitPlanFragmentFromTrack({ track: timeline.tracks[0] });

    const plan = fragment.access_units;

    assert(plan.length === 4, "units from both clips should be included");
    assert(plan[0].pts < plan.at(-1).pts, "order must be preserved");
}

function test_audio_video_symmetry() {
    const videoView = makeStubTrackView({ ptsList: [0, 1_000_000] });
    const audioView = makeStubTrackView({ ptsList: [0, 512_000, 1_024_000] });

    const videoTrack = new Track("video");
    const audioTrack = new Track("audio");

    videoTrack.addClip(new Clip({ trackView: videoView, startSeconds: 0, endSeconds: 1 }));
    audioTrack.addClip(new Clip({ trackView: audioView, startSeconds: 0, endSeconds: 1 }));

    const timeline = new Timeline();
    timeline.addTrack(videoTrack);
    timeline.addTrack(audioTrack);

    const fragment = buildAccessUnitPlanFragmentFromTrack({ track: videoTrack });

    const plan = fragment.access_units;

    assert(plan.length === 2, "video plan ok");
}

function test_determinism() {
    const trackView = makeStubTrackView({
        ptsList: [0, 1_000_000, 2_000_000]
    });

    const clip = new Clip({
        trackView,
        startSeconds: 0,
        endSeconds: 2
    });

    const track = new Track("video");
    track.addClip(clip);

    const timeline = new Timeline();
    timeline.addTrack(track);

    const fragmentA = buildAccessUnitPlanFragmentFromTrack({ track: timeline.tracks[0] });
    const fragmentB = buildAccessUnitPlanFragmentFromTrack({ track: timeline.tracks[0] });

    const a = fragmentA.access_units.map(u => u.pts);
    const b = fragmentB.access_units.map(u => u.pts);

    assert(JSON.stringify(a) === JSON.stringify(b), "output must be deterministic");
}

function test_prerender_planning_output_shape() {
    const timeline = makeMinimalVideoTimeline();

    // this function is in script.js, not a test-local fake
    const plan = buildPrerenderPlanFromTimeline({ timeline });

    assert(typeof plan === "object", "plan must be an object");
    assert(Array.isArray(plan.fragments), "plan.fragments must be an array");
    assert(plan.fragments.length >= 1, "plan.fragments must have at least one fragment");

    const first = plan.fragments[0];
    assert(first && typeof first === "object", "fragment must be an object");
    assert(first.kind === "access-units", "first fragment kind must be access-units");
    assert(Array.isArray(first.access_units), "access-units fragment must have access_units array");
}

function test_track_with_no_clips() {
    const track = new Track("video");
    const timeline = new Timeline(10);
    timeline.addTrack(track);

    const fragment = buildAccessUnitPlanFragmentFromTrack({
        track: timeline.tracks[0]
    });

    assert(
        fragment === null,
        "track with no clips must not emit an access-unit fragment"
    );
}

function test_containerClip_withNoResolvableSamples_isRejected() {

    const trackView = {
        secondsToPts: s => s * 1_000_000,
        *iterateSamplesByPtsRange() {
            // deliberately yields nothing
        }
    };

    const clip = new Clip({
        trackView,
        startSeconds: 0,
        endSeconds: 1
    });

    let threw = false;

    try {
        // force access
        [...clip.iterateAccessUnits()];
    } catch {
        threw = true;
    }

    assert(
        threw,
        "container-backed clip with no samples must be rejected"
    );
}

const COLORS = {
    blue:  "color: #4aa3ff",
    green: "color: #2ecc71",
    red:   "color: #e74c3c",
    gray:  "color: #999"
};

function log(color, label, name) {
    console.log(`%c${label}%c ${name}`,
        COLORS[color],
        COLORS.gray
    );
}

const SCRIPT_TESTS = [
    test_singleClip_fullTrack,
    test_clip_trimming,
    test_multiple_clips_same_track,
    test_audio_video_symmetry,
    test_determinism,

    // -------------------------------------------------
    // Timeline → Pre-Render Planning contract + negative tests
    // -------------------------------------------------
    test_prerender_planning_output_shape,
    test_track_with_no_clips,
    test_containerClip_withNoResolvableSamples_isRejected,
];


export async function runScriptTests({ quiet = false } = {}) {
    console.log("Running script.js tests…");

    let failures = 0;

    for (const testFn of ALL_TESTS) {
        const name = testFn.name || "<anonymous test>";

        log("blue", "RUN", name);

        try {
            const result = testFn();

            // support async + sync transparently
            if (result instanceof Promise) {
                await result;
            }

            if (!quiet) {
                log("green", "PASS", name);
            }

        } catch (err) {
            failures++;
            log("red", "FAIL", name);
            console.error(err);
        }
    }

    if (failures > 0) {
        throw new Error(`Test run completed with ${failures} failure(s)`);
    }

    console.log("ALL TESTS PASSED");
}

/* -------------------------
 * Console exposure
 * ------------------------- */

const ALL_TESTS = [
    ...SCRIPT_TESTS,
    ...TRACKVIEW_TESTS,
    ...PROCEDURAL_CLIP_TESTS,
    ...PRERENDER_DECODE_CONTAINER_VIDEO_TESTS,
    ...PRERENDER_DECODE_CONTAINER_AUDIO_TESTS,
    ...PRERENDER_DECODE_CONTAINER_ACCESS_UNITS_DISPATCH_TESTS,
    ...PRERENDER_DECODE_CONTAINER_ACCESS_UNITS_EMPTY_PLAN_TESTS,
    ...PRERENDER_DECODE_CONTAINER_ACCESS_UNITS_ORDER_TESTS,
    ...PRERENDER_DECODE_CONTAINER_ACCESS_UNITS_DETERMINISM_TESTS,
    ...PROCEDURAL_EXECUTION_TESTS,
    ...TEXT_OVERLAY_RENDERER_TESTS,
    ...CONTAINER_DECODE_TESTS,
    ...PRERENDER_TIME_RESOLUTION_TESTS,
    ...COMPOSITION_TESTS,
    ...ENCODE_TESTS,
    ...EXPORT_ADAPTER_TESTS,
    ...EXPORT_EXECUTION_STRATEGY_TESTS,
    ...INTEGRATION_TESTS,
];

// THIS is the only global leak
window.runScriptTests = runScriptTests;
