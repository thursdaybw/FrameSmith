# FrameSmith component split plan

Issue: [FrameSmith #2](https://github.com/thursdaybw/FrameSmith/issues/2)

Depends on:

- [Component split inventory](./component-split-inventory.md)

## Purpose

FrameSmith currently contains three different concerns in one repository:

```text
FrameSmith captioning frontend
media timeline / timeline compiler
native MP4 muxer / MP4 compiler
```

The product direction is to make the last two concerns reusable vanilla JavaScript libraries.

FrameSmith will remain a captioning frontend that imports those libraries.

Future pcaster GUI work will become a sibling editing frontend that imports the same libraries.

## Current production rule

`main` is production.

Do not destabilize it.

Current production baseline:

```text
production-main-2026-05-05 -> eb508320c92325173da326d6e4c063fa449043eb
```

Current split branch stream:

```text
component-split-v2       long-lived split baseline
component-split-plan-01  current planning branch
```

FrameSmith currently deploys inside `bevansbench.com` as a Git submodule. That remains true during this split.

## Non-goals for the first split

Do not solve these in the first library split:

```text
standalone FrameSmith service deployment
Drupal API changes
compute_orchestrator external API/auth
OAuth/API-key integration
npm package publishing
CDN/Netlify runtime dependency
nested submodule dependency model
```

Those are future product/platform cards.

This split is about source boundaries first.

## First dependency strategy

Use a vendored-copy strategy inside FrameSmith first.

Target shape:

```text
vendor/native-mp4-muxer/
vendor/media-timeline-compiler/
```

Why vendor-copy first:

```text
lowest deployment risk
no npm install/build step
no runtime CDN/network dependency
no nested submodule behavior to validate yet
keeps FrameSmith self-contained as a bevansbench.com submodule
lets us prove boundaries before choosing a package/distribution strategy
```

This is not the final dependency strategy. It is the safest first extraction step.

Future strategies can include:

```text
Git submodules
npm packages
GitHub package dependencies
CDN/static-hosted ESM bundles
```

but only after the public API surface is clearer and there is more than one consumer.

## Target dependency direction

The intended direction is:

```text
native MP4 muxer
  no dependency on FrameSmith
  no dependency on pcaster
  no dependency on the browser app shell

media timeline compiler
  no dependency on FrameSmith
  no dependency on pcaster
  no dependency on native muxer core

shared media engine/export glue
  may depend on timeline compiler
  may depend on native muxer
  may depend on WebCodecs/browser execution ports

FrameSmith captioning frontend
  depends on timeline compiler
  depends on native muxer/export glue
  owns captioning UX and Drupal-facing workflow

future pcaster GUI/frontend
  depends on timeline compiler
  depends on native muxer/export glue
  owns podcast/multicam editing UX
```

Clean direction:

```text
frontend apps -> shared media engine/export glue -> timeline compiler + native muxer
```

Not:

```text
native muxer -> FrameSmith
media timeline compiler -> FrameSmith
pcaster -> FrameSmith
FrameSmith -> pcaster
```

## Proposed stages

### Stage 0 — Baseline and inventory

Status: complete.

Completed:

```text
production baseline tag created
component split branch stream created
component inventory documented
FrameSmith #1 closed
```

Relevant refs:

```text
production-main-2026-05-05
component-split-v2
component-split-plan-01
docs/component-split-inventory.md
```

### Stage 1 — Document split plan

Status: this card.

Output:

```text
docs/component-split-plan.md
```

Acceptance:

```text
current production branch/tag baseline documented
branch strategy documented
target libraries documented
vendored-copy strategy documented
npm/CDN deferral explained
FrameSmith validation checklist documented
future dependency options documented
```

### Stage 2 — Native muxer library boundary cleanup

Purpose:

Prepare `src/mux/native/` to be copied into a standalone/vendored library without dragging app or timeline-specific integration tests with it.

Current candidate root:

```text
src/mux/native/
```

Target first vendor root:

```text
vendor/native-mp4-muxer/
```

Immediate cleanup work:

```text
identify native muxer public API entry points
identify internal/private modules
separate native muxer unit/oracle tests from cross-layer integration tests
ensure test runner can run from library root
add or refresh README/public API notes
```

Known cross-boundary tests to review before extraction:

```text
src/mux/native/demux/trackview/test_createContainerTrackViewFromMp4.js
src/mux/native/demux/trackview/test_proceduralClips_prerenderPlanning.js
```

These currently import app/timeline modules and look like integration tests rather than native muxer library tests.

Public API candidates used today:

```text
openContainerFromMp4
openContainer
parseAudioSpecificConfigFromEsds
createMp4FromInputs
webcodecsMp4Producer
validateMp4BuildInput
```

Likely card:

```text
FrameSmith #3 Extract native muxer into vendored library folder inside FrameSmith
```

### Stage 3 — Media timeline compiler boundary cleanup

Purpose:

Prepare `src/timeline/` to be copied into a standalone/vendored library without mixing in frontend or export pipeline concerns.

Current candidate root:

```text
src/timeline/
```

Target first vendor root:

```text
vendor/media-timeline-compiler/
```

Initial public API candidates:

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

Boundary question:

```text
Should timeline compiler v1 include only the authoring/planning model,
or should it also include procedural resolution and container execution helpers?
```

Recommended first cut:

```text
include Timeline/Track/Clip/ProceduralClip/PreRenderPlan/compileTimeline/planFragments
include pure procedural routing if it is deterministic and app-agnostic
exclude browser decode, WebCodecs, canvas composition, and mux/export orchestration
```

Known dependency to handle:

```text
src/timeline/* imports src/core/identity/createId.js
```

First extraction choice:

```text
copy createId.js into the media timeline compiler vendor/library folder
```

Do not create a separate shared-core package yet unless the duplication becomes painful.

Likely card:

```text
FrameSmith #4 Extract media timeline compiler into vendored library folder inside FrameSmith
```

### Stage 4 — Local import boundary inside FrameSmith

Purpose:

Make FrameSmith consume the vendored libraries through a stable local boundary rather than deep app-relative paths.

Two acceptable first approaches:

```text
A. import map aliases
B. local app-level barrel modules
```

Preferred first approach: import map aliases, if browser support and current deployment path are acceptable.

Example:

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

Then FrameSmith imports stable names:

```js
import { Timeline } from "@bb/media-timeline-compiler/Timeline.js";
import { openContainerFromMp4 } from "@bb/native-mp4-muxer/demux/container/openContainerFromMp4.js";
```

If import maps are not suitable in the current production browser/deployment environment, use app-local barrel modules:

```text
src/vendor-imports/mediaTimelineCompiler.js
src/vendor-imports/nativeMp4Muxer.js
```

Then app code imports:

```js
import { Timeline } from "./src/vendor-imports/mediaTimelineCompiler.js";
```

Likely card:

```text
FrameSmith #5 Update FrameSmith imports to use local vendored media libraries
```

### Stage 5 — FrameSmith behavior validation

Purpose:

Prove the split did not change the captioning frontend behavior.

Validation must remain practical for the current production deployment model.

Checklist:

```text
app loads from static browser context
captioning workflow still loads media
existing transcription/upload/status/result flow remains unchanged
preview still works
export still produces expected output
no npm install/build requirement added
no CDN/runtime network dependency added
bevansbench.com submodule assumptions remain valid
```

Automated checks where available:

```text
node run_node_tests.mjs
node run_native_muxer_node_tests.mjs
```

Manual checks still matter because browser APIs and Drupal integration are involved.

Likely card:

```text
FrameSmith #6 Validate FrameSmith production behavior on component split branch
```

### Stage 6 — Promote to split baseline

Once stages 2-5 are validated, promote the work branch into:

```text
component-split-v2
```

Do not merge to production `main` until FrameSmith behavior is proven and the deployment path has been checked.

## Future repo/package extraction

After vendored boundaries are proven, create standalone repos/projects.

Possible repo names:

```text
native-mp4-muxer
media-timeline-compiler
```

Future shape:

```text
native-mp4-muxer/
  src/
  tests/
  README.md
  index.js

media-timeline-compiler/
  src/
  tests/
  README.md
  index.js
```

FrameSmith can then move from vendored copy to one of:

```text
Git submodule
npm package
GitHub package/Git dependency
CDN/static ESM distribution
```

Do not decide that now. The right choice depends on API stability, deployment needs, and how soon pcaster GUI becomes a second consumer.

## Relationship to pcaster

pcaster's browser/media-engine integration is blocked until these boundaries are clearer.

pcaster can continue core CLI/project/timeline work, but the GUI/WebCodecs/native-rendering path should wait for:

```text
FrameSmith #3 native muxer vendored extraction
FrameSmith #4 media timeline compiler vendored extraction
FrameSmith #5 stable import boundary
```

Once this is done, pcaster can target the extracted libraries as a sibling frontend rather than depending on FrameSmith.

## Relationship to standalone FrameSmith service work

FrameSmith standalone service work is intentionally separate.

Current future direction:

```text
FrameSmith standalone service
  communicates with Drupal
  authenticated via OAuth or API key
```

That depends on `compute_orchestrator` external API work and Drupal integration decisions.

Do not mix that with this library extraction.

## Risks and mitigations

### Risk: vendored copies drift from future standalone repos

Mitigation:

```text
vendor-copy is explicitly temporary
record source commit and migration map when standalone repos are created
move to submodule/npm only after library API is stable
```

### Risk: shared media engine glue becomes a hidden third library

Mitigation:

```text
document it separately
avoid forcing it into timeline compiler or native muxer
extract it later only when its boundary is clear
```

### Risk: tests pull app concerns into library repos

Mitigation:

```text
classify tests before moving
keep cross-layer tests in FrameSmith/app integration test area
move only library-owned tests with each library
```

### Risk: import maps are not acceptable in production context

Mitigation:

```text
fallback to local barrel modules
keep all imports same-origin/static
avoid npm/build/CDN first
```

## Decision summary

Proceed with a staged, low-risk split:

```text
inventory -> plan -> vendor native muxer -> vendor timeline compiler -> update imports -> validate FrameSmith -> then consider external repos/packages
```

Keep production `main` untouched until the split branch is proven.
