# Component split inventory

Issue: [FrameSmith #1](https://github.com/thursdaybw/FrameSmith/issues/1)

Branch:

```text
component-split-plan-01
```

Production baseline:

```text
production-main-2026-05-05 -> eb508320c92325173da326d6e4c063fa449043eb
```

## Purpose

This document inventories the current pooled FrameSmith/webcodecs-test repository before extracting shared media libraries.

The immediate extraction goal is **not** to change production deployment. FrameSmith production currently stays deployed as a submodule inside `bevansbench.com`.

The immediate extraction goal is to separate these vanilla JavaScript library boundaries:

```text
native MP4 muxer / MP4 compiler
media timeline / timeline compiler
```

FrameSmith remains the captioning frontend. Future pcaster GUI work should be a sibling frontend that consumes the same libraries.

## Current production constraints

```text
main remains production
component-split-plan-01 is the planning branch
component-split-v2 is the future split baseline
```

Do not introduce these as part of the first extraction:

```text
npm dependency workflow
CDN/runtime network dependency
standalone FrameSmith service deployment
Drupal/compute_orchestrator API/auth changes
```

The first dependency strategy should be a local vendored-copy strategy inside FrameSmith, because it preserves the current static browser/submodule deployment shape while exposing cleaner boundaries.

## Rough file counts

Generated from the current branch.

| Area | Count | Notes |
|---|---:|---|
| FrameSmith frontend/root app files | 14 | Root browser app and captioning/rendering frontend files. |
| Media timeline compiler candidate | 16 JS files | `src/timeline/` plus tests/docs in that tree. |
| Native MP4 muxer candidate | 442 JS files | `src/mux/native/`, excluding markdown count differences. 489 total files were seen in that tree. |
| Shared render/export glue | 31 JS files | Decode, prerender, composition, export adapter, engine glue. |
| Test harness | 6 JS/MJS files | Root test runners and harness files outside library-specific tests. |

## FrameSmith frontend / app-specific code

These files should remain app-level for now.

They own the captioning product UI and browser workflow, not the shared media libraries.

```text
index.html
script.js
activeStyle.js
animationRegistry.js
applyAnimations.js
captionModel.js
captionRenderer.js
captionValidator.js
layout.js
mathUtils.js
stylePreset.js
textOverlayModel.js
textOverlayRenderer.js
textOverlayValidator.js
wordLayout.js
```

Supporting app assets and app-level effects:

```text
assets/
effects/
logo.png
kel.mp4
*.mp4 demo/output fixtures at repo root
*.json demo/session fixtures at repo root
```

### Current frontend coupling

`script.js` currently imports the library candidates directly:

```text
src/timeline/Timeline.js
src/timeline/Track.js
src/timeline/Clip.js
src/timeline/ProceduralClip.js
src/timeline/compileTimeline.js
src/timeline/procedural/resolvers/resolvers/textOverlayFragmentIntentResolver.js
src/timeline/procedural/resolvers/resolvers/imageOverlayFragmentIntentResolver.js
src/mux/native/demux/container/openContainerFromMp4.js
src/mux/native/demux/container/openContainer.js
src/mux/native/codec-introspection/mp4a/parseAudioSpecificConfigFromEsds.js
```

`script.js` also imports shared render/export glue:

```text
src/prerender/resolveProceduralFragmentsAtTimeFromPlan.js
src/composition/composeAtTime.js
src/prerender/strategies/ExportExecutionStrategy.js
src/prerender/decodePorts/createContainerWebCodecsDecodePort.js
src/app/debug/logEncodeDiagnostics.js
src/app/encode/EncodePipelineRun.js
src/audio/encodePcm16Wav.js
src/engine/createTimelineFromPreparedAssets.js
src/engine/engineOverlays.js
```

This confirms that FrameSmith currently acts as frontend, orchestration layer, timeline compiler consumer, native muxer consumer, and export pipeline owner in one repo.

## Media timeline compiler candidate

Candidate extraction root:

```text
src/timeline/
```

Files:

```text
src/timeline/Clip.js
src/timeline/PreRenderPlan.js
src/timeline/ProceduralClip.js
src/timeline/Timeline.js
src/timeline/Track.js
src/timeline/compileTimeline.js
src/timeline/planFragments.js
src/timeline/procedural/README.md
src/timeline/procedural/resolution/resolveProceduralSelection.js
src/timeline/procedural/resolvers/resolvers/imageOverlayFragmentIntentResolver.js
src/timeline/procedural/resolvers/resolvers/textOverlayFragmentIntentResolver.js
src/timeline/procedural/routeProceduralFragmentAtTimeToResolver.js
```

Tests currently inside the timeline tree:

```text
src/timeline/container/execution/test_executeAccessUnitFragmentDecode.js
src/timeline/procedural/resolvers/test_executeProceduralFragmentAtTime.js
src/timeline/procedural/resolvers/test_imageOverlayRenderer.js
src/timeline/procedural/resolvers/test_textOverlayRenderer.js
```

A container execution file also lives inside `src/timeline`:

```text
src/timeline/container/execution/executeAccessUnitFragmentDecode.js
```

That file may belong to render/pre-render execution rather than the pure timeline compiler. It should be reviewed before extraction.

### Timeline compiler public API candidates

Initial public surface candidates:

```text
Timeline
Track
Clip
ProceduralClip
PreRenderPlan
buildPrerenderPlanFromTimeline
planFragments helpers
procedural fragment routing/resolution
```

### Timeline compiler dependency observations

Current timeline classes import shared identity code:

```text
src/timeline/Clip.js     -> src/core/identity/createId.js
src/timeline/Timeline.js -> src/core/identity/createId.js
src/timeline/Track.js    -> src/core/identity/createId.js
```

Extraction choice:

```text
Option A: copy createId.js into the media timeline compiler library
Option B: create a tiny shared core package later
```

For first vendored extraction, Option A is simpler.

## Native MP4 muxer / MP4 compiler candidate

Candidate extraction root:

```text
src/mux/native/
```

This tree is already heavily self-contained and has its own docs:

```text
src/mux/native/README.md
src/mux/native/MANIFESTO.md
src/mux/native/WHY-NATIVE-MUXER.md
src/mux/native/WHY-THIS-EXISTS-FOR-HUMANS.md
src/mux/native/NativeMuxer.CompilerPipeline.md
src/mux/native/NATIVE_MUXER_SERIALIZATION.md
src/mux/native/ENCODING-LANDSCAPE.md
src/mux/native/Structural_Fidelity_vs_Convenience.md
src/mux/native/Opus.md
```

Top-level module groups:

```text
src/mux/native/adapters/
src/mux/native/assemblers/
src/mux/native/binary/
src/mux/native/box-emitters/
src/mux/native/box-model/
src/mux/native/box-schema/
src/mux/native/builders/
src/mux/native/bytes/
src/mux/native/codec-introspection/
src/mux/native/codec-normalization/
src/mux/native/codecs/
src/mux/native/commit/
src/mux/native/compiler/
src/mux/native/composers/
src/mux/native/debug/
src/mux/native/demux/
src/mux/native/derivers/
src/mux/native/inspection/
src/mux/native/layout/
src/mux/native/mdat/
src/mux/native/normalization/
src/mux/native/policies/
src/mux/native/producers/
src/mux/native/reference/
src/mux/native/serializer/
src/mux/native/tests/
```

Root entry-ish files:

```text
src/mux/native/emitMp4FileFromResolvedParts.js
src/mux/native/resolvePhysicalLayout.js
src/mux/native/validateMp4BuildInput.js
```

Public API candidates used by FrameSmith today:

```text
src/mux/native/demux/container/openContainerFromMp4.js
src/mux/native/demux/container/openContainer.js
src/mux/native/codec-introspection/mp4a/parseAudioSpecificConfigFromEsds.js
src/mux/native/compiler/createMp4FromInputs.js
src/mux/native/producers/webcodecsMp4Producer.js
src/mux/native/validateMp4BuildInput.js
```

### Native muxer extraction notes

The native muxer tree includes a large internal test/oracle suite under:

```text
src/mux/native/tests/
```

The current root runner is:

```text
run_native_muxer_node_tests.mjs
```

For extraction, the test runner should move with the native muxer library or be replaced by an equivalent library-local runner.

### Native muxer dependency observations

Two test files inside the native muxer currently import app/frontend or timeline modules:

```text
src/mux/native/demux/trackview/test_createContainerTrackViewFromMp4.js
  -> script.js
  -> src/timeline/planFragments.js

src/mux/native/demux/trackview/test_proceduralClips_prerenderPlanning.js
  -> script.js
  -> src/timeline/planFragments.js
  -> src/timeline/ProceduralClip.js
```

These look like integration tests, not native muxer library tests. They should probably move out of the native muxer library during extraction.

## Shared render/export glue

These files are not obviously FrameSmith-only, but they are also not pure timeline compiler or pure native muxer.

They should be treated as a third layer for now: shared media engine glue / application service layer.

```text
src/app/debug/logEncodeDiagnostics.js
src/app/encode/EncodePipelineRun.js
src/audio/encodePcm16Wav.js
src/composition/composeAtTime.js
src/core/identity/createId.js
src/demux/Mp4BoxDemuxer.js
src/demux/MuxJsDemuxer.js
src/encode/encodeAtTime.js
src/engine/createTimelineFromPreparedAssets.js
src/engine/engineOverlays.js
src/export/adaptEncodedOutputsToMp4BuildInput.js
src/prerender/DecodedContainerBackedFragmentBatch.js
src/prerender/decodeContainerAccessUnitsFromPreRenderPlanBatch.js
src/prerender/decodePorts/createContainerWebCodecsDecodePort.js
src/prerender/executePreRenderPlan.js
src/prerender/resolveProceduralFragmentsAtTimeFromPlan.js
src/prerender/strategies/ExportExecutionStrategy.js
src/types/EncodedSampleLike.js
```

Tests currently in this shared glue area:

```text
src/audio/test_encodePcm16Wav.js
src/composition/test_composeAtTime.js
src/encode/test_encodeAtTime.js
src/export/test_adaptEncodedOutputsToMp4BuildInput.js
src/integration/test_FrameSmith_PublicApi_EndToEnd_ExportExecutionStrategy.js
src/prerender/strategies/test_ExportExecutionStrategy.js
src/prerender/test_decodeContainerAccessUnitsFromPreRenderPlan_determinism.js
src/prerender/test_decodeContainerAccessUnitsFromPreRenderPlan_ignoresProceduralFragments.js
src/prerender/test_decodeContainerAccessUnitsFromPreRenderPlan_noAccessUnits.js
src/prerender/test_decodeContainerAccessUnitsFromPreRenderPlan_preservesDecoderOrder.js
src/prerender/test_decodeContainerAccessUnits_containerAudio.js
src/prerender/test_decodeContainerAccessUnits_containerVideo.js
src/prerender/test_resolveProceduralFragmentsAtTimeFromPlan.js
```

### Shared glue dependency observations

`src/engine/createTimelineFromPreparedAssets.js` constructs timeline objects:

```text
Timeline
Track
Clip
ProceduralClip
```

That makes it an adapter/application-service candidate, not a timeline compiler primitive.

`src/export/adaptEncodedOutputsToMp4BuildInput.js` depends on native muxer concepts:

```text
webcodecsMp4Producer.js
validateMp4BuildInput.js
```

That makes it export-adapter glue between encoded WebCodecs outputs and the native muxer build input.

`src/prerender/strategies/ExportExecutionStrategy.js` depends on the native muxer compiler:

```text
src/mux/native/compiler/createMp4FromInputs.js
```

That makes it an orchestration/use-case layer rather than part of the native muxer core.

`src/prerender/*` depends on timeline `planFragments` and procedural routing. This area likely belongs near the media engine, but it is not the pure authoring model.

## Test harness and scripts

Root test runners:

```text
run_node_tests.mjs
run_native_muxer_node_tests.mjs
```

Other harness/support locations:

```text
test/
tests/
test-harness/
scripts/
```

Extraction note:

- media timeline compiler gets a small library-local test runner
- native muxer gets its own existing native muxer runner/test suite
- FrameSmith keeps app/integration tests proving the frontend still works with vendored libraries

## Existing architecture docs to preserve/reference

FrameSmith frontend/media-engine overview:

```text
docs/framesmith-architecture.md
docs/Architecture.md
docs/ROADMAP.md
```

Native muxer docs:

```text
docs/NativeMuxer.Architecture.md
docs/MUXER.md  # historical/obsolete
docs/WebM.Demux.Architecture.md
src/mux/native/*.md
```

The native muxer already has much stronger internal documentation than the timeline compiler. The timeline compiler should get a README/public API document during extraction.

## Proposed first extraction order

### 1. Native muxer inventory cleanup

The native muxer is large but already has a clear directory boundary and internal docs.

Before moving it, separate native muxer unit tests from cross-layer integration tests that import `script.js` or timeline compiler modules.

### 2. Media timeline compiler inventory cleanup

The timeline compiler is smaller, but its boundary is less complete because pre-render/decode/procedural execution code straddles the authoring model and render/export pipeline.

Before moving it, decide whether the first library includes only:

```text
Timeline / Track / Clip / ProceduralClip / compileTimeline / planFragments
```

or also includes procedural resolution and container decode helpers.

### 3. Vendor-copy both libraries back into FrameSmith

Initial target shape:

```text
vendor/native-mp4-muxer/
vendor/media-timeline-compiler/
```

This keeps FrameSmith deployable as a static browser app/submodule without npm, CDN, or nested submodule changes.

### 4. Add stable import boundary

Prefer an import map or explicit local barrel modules so FrameSmith imports stable names rather than deep internal paths.

Possible browser import map:

```html
<script type="importmap">
{
  "imports": {
    "@bb/media-timeline-compiler/": "./vendor/media-timeline-compiler/src/",
    "@bb/native-mp4-muxer/": "./vendor/native-mp4-muxer/src/"
  }
}
</script>
```

Do not add npm packaging until multiple consumers exist and the API is stable.

## Acceptance check for this inventory

This inventory satisfies FrameSmith #1 by identifying:

```text
FrameSmith frontend files
media timeline compiler files
native muxer files
shared/ambiguous support modules
first extraction order
production constraints
```

The next card should turn this into a staged split plan:

```text
FrameSmith #2 Document component split plan for FrameSmith/webcodecs-test
```
