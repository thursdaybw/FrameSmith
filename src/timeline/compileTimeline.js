/** Timeline Compilation Use Cases
 *
 * This module defines PURE application use cases for
 * evaluating a Timeline into deterministic execution plans.
 *
 * It contains:
 * - NO DOM
 * - NO media decoding
 * - NO rendering
 * - NO playback
 *
 * It operates ONLY on:
 * - Timeline
 * - Track
 * - Clip
 * - TrackView interfaces
 */

import {
    createAccessUnitPlanFragment,
    createProceduralPlanFragment
} from "./planFragments.js";

import { PreRenderPlan } from "./PreRenderPlan.js";

/**
 * iterateTrackClipItemsWithProvenance
 *
 * Single owner of the "track and clip provenance" rule.
 *
 * Contract:
 * - Walk clips in track order
 * - Emit items in clip order
 * - Attach { clip, track } to every emitted item
 *
 * This is the shared primitive used by all track → fragment builders.
 *
 *  ============================================================================
 *  TRACK → FRAGMENT DERIVATION CONTRACT
 *  ============================================================================
 * 
 *  Any function that derives plan fragments from a Track MUST:
 * 
 *  - Walk Clips in track order
 *  - Respect Clip time boundaries
 *  - Preserve references to BOTH:
 *      - the originating Clip
 *      - the originating Track
 * 
 *  WHY THIS EXISTS:
 *  - Track-level settings (mute, gain, transforms, fades, effects, etc)
 *    apply across ALL clips on a track.
 *  - Clip-level settings apply only within clip bounds.
 *  - Planning must NOT apply these rules — only preserve enough information
 *    for execution to apply them later.
 * 
 *  THIS CONTRACT APPLIES TO:
 *  - buildAccessUnitPlanFragmentFromTrack
 *  - buildProceduralPlanFragmentFromTrack
 * 
 *  If this contract changes, ALL track→fragment builders must be updated
 *  together.
 *
 *
 * @param {Object} params
 * @param {Track} params.track
 * @param {Function} params.iterateClipItems   (clip) => iterable
 * @returns {Array<Object>} items
 */
export function iterateTrackClipItemsWithProvenance({ track, iterateClipItems }) {
    if (!track) {
        throw new Error("iterateTrackClipItemsWithProvenance: track required");
    }
    if (typeof iterateClipItems !== "function") {
        throw new Error("iterateTrackClipItemsWithProvenance: iterateClipItems function required");
    }

    const items = [];

    for (const clip of track.clips) {
        for (const item of iterateClipItems(clip)) {
            items.push({
                ...item,
                clip,
                track
            });
        }
    }

    return items;
}


/**
 * buildAccessUnitPlanFragmentFromTrack
 *
 * OFFLINE / DETERMINISTIC
 *
 * Contract:
 * - Evaluates a *single, already-selected Track*
 * - Emits container-backed access-unit intent
 *
 * Structural rules:
 * - Clip ordering is preserved
 * - Access-unit ordering is preserved
 * - { clip, track } provenance is attached to every unit
 *
 * This function does NOT own:
 * - Track selection
 * - Procedural intent
 * - Media interpretation
 *
 * @param {Object} params
 * @param {Track} params.track
 *
 * @returns {Object} fragment
 *   An access-units plan fragment
 */
export function buildAccessUnitPlanFragmentFromTrack({ track }) {

    if (!track.clips.some( clip => typeof clip.iterateAccessUnits === "function")) {
        return null;
    }

    const units = iterateTrackClipItemsWithProvenance({
        track,
        iterateClipItems: (clip) => {
            if (typeof clip.iterateAccessUnits !== "function") return [];

            return clip.iterateAccessUnits().map(accessUnit => ({
                pts: accessUnit.pts,
                dts: accessUnit.dts,
                duration: accessUnit.duration,
                isKeyframe: accessUnit.isKeyframe,
                data: accessUnit.data
            }));
        }
    });

    return createAccessUnitPlanFragment({ units });
}

/**
 * buildProceduralPlanFragmentFromTrack
 *
 * OFFLINE / DETERMINISTIC
 *
 * Contract:
 * - Evaluates a *single, already-selected Track*
 * - Emits procedural intent contributed by clips and track-level settings
 *
 * Structural rules:
 * - Clip ordering is preserved
 * - Procedural items are time-bounded, not sample-based
 * - { clip, track } provenance is attached to every item
 *
 * What this function DOES NOT decide:
 * - How duration is rendered
 * - How effects are executed
 * - Whether items affect video, audio, or both
 *
 * Those decisions belong to the execution layer.
 *
 * @param {Object} params
 * @param {Track} params.track
 *
 * @returns {Object|null} fragment
 *   A procedural plan fragment, or null if no procedural intent exists
 */
export function buildProceduralPlanFragmentFromTrack({ track }) {
    const items = iterateTrackClipItemsWithProvenance({
        track,
        iterateClipItems: (clip) => {
            if (typeof clip.iterateProceduralItems !== "function") return [];
            return clip.iterateProceduralItems();
        }
    });

    if (items.length === 0) {
        return null;
    }

    const proceduralKind = items[0].kind;

    return createProceduralPlanFragment({
        kind: proceduralKind,
        items
    });
}

/**
 * buildPrerenderPlanFromTimeline
 * =====================================================
 *
 * APPLICATION USE CASE — PRE-RENDER PLANNING
 *
 * Purpose:
 * --------
 * - Derive a deterministic **Pre-Render Plan** from a Timeline.
 * - Execute offline timeline evaluation.
 * - Select demo tracks.
 * - Produce a Pre-Render Plan describing what will be consumed by the Offline Rendering (Pre-Render) stage.
 *
 * This function is intentionally explicit and verbose.
 *
 * The Pre-Render Plan describes *what work must be executed*
 * by the offline pre-render phase, without performing that work.
 *
 * A Timeline is structural intent.
 * A Pre-Render Plan is executable intent.
 *
 * This function bridges the two.
 *
 * What this function DOES:
 * ------------------------
 * - Walks selected Tracks in the Timeline
 * - Emits typed **plan fragments** describing downstream work
 * - Assembles those fragments into a single Pre-Render Plan
 *
 * Fragment semantics:
 * -------------------
 * - A plan fragment is NOT media data
 * - A plan fragment is NOT an access unit
 * - A plan fragment DESCRIBES work to be performed later
 *
 * Current fragment kinds include:
 * - "access-units"   (container-backed media)
 *
 * Future fragment kinds will include:
 * - text overlays
 * - images
 * - procedural effects
 * - generated media
 *
 * What this function EXPLICITLY DOES NOT DO:
 * -----------------------------------------
 * - Decode media
 * - Render frames or audio
 * - Sample wall-clock time
 * - Interleave or synchronise tracks
 * - Perform preview, playback, or encoding
 *
 * Architectural Notes:
 * --------------------
 * - Track selection here is APPLICATION POLICY
 *   (demo-specific, not a FrameSmith invariant)
 *
 * - The returned plan is a **phase contract**
 *   between timeline compilation and pre-render execution
 *
 * Invariants:
 * -----------
 * - Output is deterministic for a given Timeline
 * - No browser, DOM, or playback APIs are accessed
 * - The Timeline is not mutated
 *
 * @param {Object} params
 * @param {Timeline} params.timeline
 *
 * @returns {Object} prerenderPlan
 *   {
*     fragments: Array<PlanFragment>
*   }
*/
export function buildPrerenderPlanFromTimeline({ timeline }) {
    if (!timeline || timeline.duration === 0) {
        throw new Error("buildPrerenderPlanFromTimeline: invalid or empty timeline");
    }

    const fragments = [];

    for (const track of timeline.tracks) {

        const accessUnitFragment = buildAccessUnitPlanFragmentFromTrack({ track });

        if (accessUnitFragment) {
            fragments.push(accessUnitFragment);
        }

        const proceduralFragment = buildProceduralPlanFragmentFromTrack({ track });

        if (proceduralFragment) {
            fragments.push(proceduralFragment);
        }
    }

    return new PreRenderPlan({ fragments });
}
