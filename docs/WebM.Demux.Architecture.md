# WebM Demux Architecture (FrameSmith)

Date: February 14, 2026
Status: Planned

## Purpose

This document defines how WebM demux support is added without making a mess.

Main goals:

- Keep one app-facing container API.
- Keep one extractor registry style.
- Keep one selector lookup style.
- Keep one normalized `trackView` output contract.
- Keep MP4 and WebM parsing logic separate.

## Why We Are Doing This

Some phone files are playable in a browser video element but not decodable through WebCodecs `VideoDecoder` for the needed path.

WebM demux support gives us a practical normalization path for unsupported sources.

## Top-Level Container API

Public facade (single entry point):

- `openContainer({ containerType, byteSource })`

Rules:

- `containerType` is the format hint (`"mp4"` or `"webm"`).
- `byteSource` is the byte input object (range-readable).
- If `containerType` is missing, container sniffing decides the adapter.
- No `bytes` arg on the long-term facade contract.

Facade delegates to container-specific adapters:

- `openContainerFromMp4Source({ mp4ByteSource })`
- `openContainerFromWebmSource({ webmByteSource })`

No app-level branching on container type outside this facade.

Transitional rule (do not break current MP4):

- Keep legacy MP4 entry points working as-is for now (`openContainerFromMp4({ mp4Bytes })`).
- Add WebM seam-first (`openContainerFromWebmSource`) from day one.

## Registry + Selector Strategy

We keep the same extractor model used today.

- Selector lookup remains: `registry.getExtractor(selector)`
- Extractors stay pure: `(node, context) -> semantic output`
- Registry remains explicit and testable

Important:

- We reuse the pattern, not MP4-specific resolver code.
- WebM has a different parser/walker and selector builder.
- We do not invent a second selector API.

Examples of selector style:

- MP4: `moov/trak/mdia/minf/stbl/stsd|avc1/avcC`
- WebM: `segment/tracks/trackEntry|V_VP9`

## WebM Parsing Model

WebM is not MP4 box headers.

WebM uses EBML elements with:

- element ID (variable length)
- element size (variable length)
- payload bytes

So the model is still "walk a container tree", but with different binary rules.

## Minimum WebM Scope for MVP

Only implement what is required to produce timeline-ready access units and codec config.

1. Segment timing
- `Segment/Info/TimecodeScale` (default if missing)

2. Track metadata
- `Tracks/TrackEntry`
- `TrackNumber`, `TrackType`, `CodecID`
- `CodecPrivate` (when present)
- video dimensions for video tracks

3. Sample extraction
- `Cluster/Timecode`
- `SimpleBlock` first
- `BlockGroup` next if needed

4. Per-sample semantic output
- track number
- timestamp
- keyframe flag
- payload bytes

5. Normalize to existing output contract
- build the same `trackViews` shape used by MP4 path
- expose codec config and sample timing in the same form decode/export already consumes

## Contracts and Boundaries

### Input boundary

Container adapters accept bytes through a `*ByteSource` interface.

Planned byte-source contract:

- `sizeBytes`
- `readRange(offset, length)`
- `readAll()` (compatibility path)

### Output boundary

Both MP4 and WebM adapters must return the same semantic shape:

- `trackViews`
- normalized timing
- codec config per track
- container display metadata when applicable

If this output diverges by container type, architecture has failed.

## Interaction with Decode Strategy

Decode strategy seam already exists (`decodePort.decodeRange`).

WebM work should connect through source normalization, not by growing runtime fallback chains.

Target flow:

1. Source analyzed
2. If unsupported for normal decode path: normalize clip-range source to WebM
3. Demux normalized WebM
4. Continue through normal decode + compose + encode flow

## Non-Goals (for this phase)

- Full Matroska feature coverage
- WebM muxer implementation
- Rewriting MP4 demux internals in this same step
- App-level container branching spread across the codebase

## Test Plan (Required)

1. Unit tests for WebM parser primitives
- EBML ID/size parsing
- element traversal

2. Registry/selector tests
- WebM selector resolution
- extractor dispatch agreement

3. TrackView contract parity tests
- MP4 and WebM return the same shape for common fields

4. End-to-end demux tests
- WebM fixture -> access units + codec config -> decode path accepts output

5. Guard tests
- missing fields fail with clear errors
- unsupported WebM features fail explicitly (not silent corruption)

## Implementation Order

1. Add facade `openContainer(...)` with routing skeleton.
2. Add WebM source adapter entry point (`openContainerFromWebmSource({ webmByteSource })`).
3. Add EBML parser/walker primitives.
4. Add WebM selector builder + registry skeleton.
5. Implement MVP extractors (`Info`, `Tracks`, `Cluster/SimpleBlock`).
6. Normalize to `trackViews` contract.
7. Add parity and end-to-end tests.
8. Wire to source-normalization flow for unsupported sources.

## Architecture Guardrails

- Keep parser and extractor layers separate.
- Keep decode strategy and source normalization separate.
- Keep container routing at one facade, not everywhere.
- Keep docs and tests updated before adding more container features.
