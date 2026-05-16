# NativeMuxer Semantic Fixtures

This directory contains **canonical semantic fixtures** used to validate the
NativeMuxer compilation pipeline independently of MP4 parsing or browser APIs.

These fixtures represent the **normalized semantic input contract** that
NativeMuxer consumes.

They are intentionally:

- MP4-file independent
- WebCodecs independent
- parser independent
- byte-for-byte authoritative once frozen

---

## What These Fixtures Are

The fixtures in this directory define the **semantic IR (intermediate representation)**
for NativeMuxer.

They describe:

- encoded video samples
- codec configuration
- track-level metadata
- movie-level metadata

This is the minimal information required to deterministically produce a valid MP4 file.

Think of these fixtures as:

- compiler input programs
- reference semantic truth
- adapter conformance targets

They are not helpers.
They are not mocks.
They are not test data generated on the fly.

They are **frozen truth**.

---

## Relationship to MP4

These fixtures are **not derived at runtime** from MP4 files.

They may be *initially extracted once* from a golden MP4 as a grounding exercise,
but once written, they stand alone.

NativeMuxer does **not** read MP4 bytes.
NativeMuxer consumes **semantic meaning only**.

The purpose of these fixtures is to prove that:

> Given correct semantics, NativeMuxer produces a correct MP4.

---

## Relationship to WebCodecs

These fixtures define the **target output shape** of the WebCodecs adapter.

The WebCodecs adapter will eventually perform this transformation:

```

EncodedVideoChunk + VideoDecoderConfig
→ normalized semantic fixtures
→ NativeMuxer pipeline

```

The adapter must conform to the structure defined here.

NativeMuxer will not adapt itself to WebCodecs.
WebCodecs must adapt to this semantic contract.

---

## What These Fixtures Must NOT Contain

The following are explicitly forbidden:

- MP4 box structures
- file offsets
- byte sizes
- layout assumptions
- derivation logic
- policy decisions
- browser APIs
- WebCodecs objects

If any of the above appear here, the architecture has been violated.

---

## Why These Fixtures Exist

These fixtures serve three critical purposes:

1. **Truth Preservation**
   They allow NativeMuxer to be tested without parsing MP4 files.

2. **Boundary Enforcement**
   They clearly separate input adaptation from compilation logic.

3. **Future Adapter Safety**
   They prevent WebCodecs (or any other input source) from leaking
   assumptions into the compiler.

---

## Stability Contract

Once these fixtures are frozen and validated by end-to-end tests:

- Changes must be deliberate
- Changes must be reviewed as semantic contract changes
- Byte-for-byte regressions are not permitted

Treat this directory as you would treat a compiler IR specification.

---

## Summary

If NativeMuxer is a compiler, these fixtures are its programs.

Everything upstream must adapt to them.
Everything downstream assumes them.

They are the seam that makes the architecture sustainable.
