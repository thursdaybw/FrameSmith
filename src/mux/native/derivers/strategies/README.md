# Derivation Strategies

Derivation strategies define **how semantic media samples are transformed into structure**.

They exist to make explicit, testable choices about *which algorithm* is used
when deriving structural models from semantic input.

This directory is intentionally narrow in scope.

---

## What strategies are

Strategies:

- select **one of several valid derivation algorithms**
- operate **before any structure exists**
- affect **topology**, not representation
- are chosen **at call time**
- do not mutate semantic input
- do not emit bytes
- do not apply container compatibility rules

A strategy answers one question:

> “Given the same semantic samples, how do we derive structure?”

---

## What strategies are not

Strategies are **not** policies.

They do not:

- modify already-derived structure
- exist to match other tools
- enforce compatibility quirks
- invent container-level fields
- operate after emitters
- touch serialization

If a decision changes *how samples are grouped or ordered*, it is a strategy.

If a decision changes *how an already-derived structure is written*, it is a policy.

---

## Position in the pipeline

Strategies are selected at the point of derivation.

```

semantic samples
→ derivation strategy selection
→ derivers (structure creation)
→ adapters
→ policies
→ emitters
→ bytes

```

Once derivation begins, the strategy choice is fixed.

---

## Why this layer exists

There are often multiple correct ways to derive structure
from the same semantic input.

For example:
- grouping every sample into its own chunk
- grouping all samples into a single chunk

Both are valid.
Both produce playable MP4 files.
They differ only in **structure**, not meaning.

By naming these choices as strategies, we ensure that:

- derivation behavior is explicit
- tests are clear about intent
- structure changes cannot accidentally leak into policies
- future algorithms have a clear home

---

## Design rule (hard boundary)

If removing a decision changes the *shape of the structure*,
it belongs here.

If removing a decision still produces the same structure,
it does not.

