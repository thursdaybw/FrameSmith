# Normalization

The normalization layer is responsible for completing intrinsic,
deterministic media facts that are required by downstream stages
but are not always explicitly present in source inputs.

Normalization exists to make the rest of the compiler boring.

After normalization:
- all required semantic fields are present
- all invariants are enforced
- downstream code must not infer, guess, or defend itself

Normalization is NOT:
- derivation of container structure
- application of container policy
- MP4 box shaping or emission
- layout or offset calculation

Normalization has exactly one valid outcome for any given input.
If more than one valid outcome exists, the decision does NOT belong here.

## Current responsibilities

At the current stage of the NativeMuxer, normalization performs
the following completions on access units:

1. Add access unit durations
   - Derived from PTS deltas
   - Deterministic
   - Required for timing, chunking, and tables

2. Add sampleDescriptionIndex
   - Exactly one sample description per track is supported
   - Therefore, all access units must reference index = 1

These steps are explicit and isolated.
If either rule changes, it changes here and only here.

## Architectural position

semantic input
→ normalization
→ derivation
→ adaptation
→ container policy
→ emission
