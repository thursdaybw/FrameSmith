# RenderPlan (Seam Only — MVP Phase)

This directory exists to define the shape and direction of the future
RenderPlan system. No operational logic lives here yet.

Modules in this directory define:
- RenderPlan node shape
- RenderPlan root structure
- Placeholder factories for future layout/effect/animation pipelines

The rest of the system must be written with the assumption
that a full RenderPlan will slot in between:

LayoutEngine → RenderPlan → Renderer

Renderer MUST remain a dumb painter that consumes declarative nodes.

