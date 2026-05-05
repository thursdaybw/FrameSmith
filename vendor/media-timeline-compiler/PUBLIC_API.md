# Media timeline compiler public API notes

This folder is the first vendored extraction of the media timeline compiler from FrameSmith.

Source at extraction time:

```text
src/timeline/
```

Vendored target:

```text
vendor/media-timeline-compiler/
```

This is still a vendored copy inside FrameSmith, not yet an npm package, CDN artifact, Git submodule, or standalone repo checkout.

## Current public API candidates

The first public surface is:

```text
Timeline
Track
Clip
ProceduralClip
PreRenderPlan
buildPrerenderPlanFromTimeline
buildAccessUnitPlanFragmentFromTrack
buildProceduralPlanFragmentFromTrack
PreRenderPlanFragmentKinds
PreRenderPlanContributorKinds
createAccessUnitPlanFragment
createProceduralPlanFragment
isProceduralPlanFragment
routeProceduralFragmentAtTimeToResolver
resolveTextOverlayFragmentIntentAtTime
resolveImageOverlayFragmentIntentAtTime
executeAccessUnitFragmentDecode
```

The convenience barrel is:

```text
vendor/media-timeline-compiler/index.js
```

## Local helper copied into boundary

The original timeline classes used FrameSmith's shared identity helper:

```text
src/core/identity/createId.js
```

For this first vendored boundary, the helper is copied locally:

```text
vendor/media-timeline-compiler/core/identity/createId.js
```

Do not create a separate shared-core package yet. The helper is tiny, and duplicating it here keeps the first boundary simple and self-contained.

## Test strategy

The timeline compiler owns this node runner:

```bash
node vendor/media-timeline-compiler/run_node_tests.mjs
```

FrameSmith/media-engine integration tests remain at the repo root and under `test-harness/`.

## Boundary notes

This vendored boundary includes deterministic timeline authoring/planning/procedural intent code.

The following remain outside this library for now:

```text
FrameSmith app UI
browser bootstrapping
canvas composition
WebCodecs encode/decode ports
MP4 export orchestration
FrameSmith/media-engine integration tests
```

Future extraction can move this folder into a standalone repository once the API surface is proven by another consumer.
