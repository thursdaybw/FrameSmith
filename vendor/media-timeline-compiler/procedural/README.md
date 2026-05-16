# Procedural Timeline Logic

This directory contains logic related to procedural (non-container-backed)
timeline clips.

## Responsibilities

Procedural code here may:

- Reason about clip activity over time
- Resolve procedural intent into deterministic, time-resolved data
- Perform evaluation without side effects

## Explicit Non-Responsibilities

Code here must NOT:

- Create VideoFrame or AudioData
- Decode media
- Render pixels
- Perform composition
- Invoke WebCodecs or browser rendering APIs

Those responsibilities belong to later execution and composition phases.

## Subdirectories

- evaluation/
  Resolves procedural clips into fully evaluated, render-ready intent
  without producing media buffers.
