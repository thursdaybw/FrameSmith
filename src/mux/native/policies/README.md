# Policies

Policies apply **container-level decisions** that are not part of semantic
media meaning and are not derivable from encoder output alone.

They exist to make explicit, testable choices about *how* semantic data is
written into an MP4 file.

## What policies are

Policies:
- operate after adapters
- act on emitter-ready data
- apply deterministic, explicit rules
- may add, remove, or modify container-level structure
- are opt-in and named

Policies represent *intentional compatibility choices*.

Examples:
- ffmpeg-compatible AVCDecoderConfigurationRecord extensions
- brand compatibility lists
- box ordering constraints
- legacy QuickTime fields required by specific players

## What policies are not

Policies:
- are not semantic derivation
- do not inspect or interpret codec bitstreams
- do not invent semantic facts
- do not emit bytes
- do not contain serialization logic

Policies never guess.
If required information is missing, they fail loudly.

## Why this layer exists

MP4 allows multiple valid representations of the same semantic media.
Different tools make different, historically motivated choices.

Rather than hiding those choices in adapters or emitters, Framesmith
makes them explicit as policies.

This preserves:
- determinism
- portability
- architectural clarity
- testability

## Position in the pipeline

semantic fixtures
→ derivers
→ adapters
→ **policies**
→ emitter input
→ box emitters

## Design principle

If a decision can change without altering the meaning of the media,
it is a policy.

If removing it still produces a valid MP4, it is a policy.

If it exists to match another tool’s output, it is a policy.

### esds (Audio)

Framesmith does not currently apply container policies to esds.

Although some tools normalize esds descriptor graphs, doing so requires
parsing ISO/IEC 14496-1 descriptor structures and is therefore considered
codec adaptation, not container policy.

Any future esds handling must live outside the policy layer.
