## FrameSmith / NativeMuxer Code Constitution

This codebase prioritizes architectural clarity over cleverness.

I would love it if JavaScript read just like PHP.

JavaScript must read as calm, vertically structured system code — not compressed functional expressions.

---

## 1. Architectural Layer Discipline

1. Each file represents exactly one conceptual layer.
2. A function may operate at only one conceptual level.
3. A function may call:

   * Functions in the same layer
   * Functions in the layer directly beneath it
4. A function must not mix:

   * Policy
   * Structural derivation
   * Execution
   * Infrastructure wiring

No conceptual jumping inside a single function.

---

## 2. Vertical Flow Rule

Code must read top-to-bottom like structured PHP.

Avoid expression compression.

Instead of:

```js
return items.filter(a => a.enabled).map(a => adapt(a)).reduce(sum);
```

Write:

```js
const enabledItems = filterEnabled(items);
const adaptedItems = adaptItems(enabledItems);
const result = sumItems(adaptedItems);

return result;
```

Intermediate variables are encouraged.
Clarity > brevity.

---

## 3. Anonymous Function Restrictions

Anonymous functions are forbidden except:

* Trivial one-line predicates
* Event listeners that delegate immediately

Forbidden:

* Nested arrow functions with domain meaning
* Anonymous functions longer than one expression
* Inline object construction that encodes domain policy

All domain behaviour must be named.

If it has meaning, it gets a name.

---

## 4. Chain Depth Limit

Maximum chain depth: 2.

Allowed:

```js
items.filter(isEnabled).map(adapt);
```

Not allowed:

```js
items.filter(...).map(...).reduce(...).sort(...).flatMap(...)
```

Break chains into vertical steps.

---

## 5. No Hidden Ownership

* State must have a clear owner.
* Mutation must be explicit.
* Functions must not mutate inputs unless explicitly documented.
* Closure-based hidden state is discouraged.

Prefer explicit state objects over captured variables.

---

## 6. Execution Clarity

It must always be possible to answer immediately:

* What runs first?
* What runs next?
* What calls this?
* What does this return?
* What does this mutate?

If this is unclear, the function is too dense.

---

## 7. Naming Discipline

Names must reveal:

* Layer
* Responsibility
* Direction

Avoid vague names:

* process
* handle
* compute
* build (unless very specific)

Prefer:

* deriveTrackStructure
* assembleMoovBox
* executePreRenderPlan
* adaptCodecConfiguration

If a name feels generic, it is wrong.

---

## 8. File Size Guidance

If a file contains multiple conceptual layers, split it.

If reading 20 lines requires understanding 4 separate ideas, refactor.

---

## 9. No Magic Abstraction

Avoid introducing abstraction layers unless:

* They reduce conceptual load.
* They align with the architecture tiers.
* They clarify ownership.

Abstraction must reduce confusion, not increase it.

---

## 10. Calmness Test

If reading a function causes mental tension after 5 lines, it violates this constitution.

Refactor until the function feels calm.

Calm means:

* Linear
* Predictable
* Bounded
* Explicit


## 11. Dependency Direction Rule

Dependencies must point inward.

Outer layers may depend on inner layers.
Inner layers must never depend on outer layers.

For example:

* UI → Application
* Application → Domain
* Domain → (nothing)

Domain must not import:

* UI
* Browser APIs
* Network code
* Storage code

If a domain file imports `document`, `window`, `fetch`, or any DOM API, it violates this rule.

---

## 12. Domain Purity Rule

Domain logic must be:

* Deterministic
* Side-effect free
* Independent of environment

Domain functions must not:

* Access the DOM
* Read from global state
* Mutate shared state
* Perform I/O

Domain = pure business logic.

---

## 13. Application Layer Rule

The application layer:

* Orchestrates domain logic.
* Coordinates use cases.
* Does not contain UI code.
* Does not contain infrastructure code.

It wires together domain policies and infrastructure adapters.

Application layer may:

* Call domain functions.
* Call infrastructure adapters.
* Return structured results.

It may not embed policy.

---

## 14. Infrastructure Isolation Rule

Infrastructure includes:

* DOM manipulation
* Browser APIs
* Storage
* Network
* File APIs
* WebCodecs
* WebAssembly
* External scripts

Infrastructure must live in outer layers only.

Infrastructure must adapt to the application layer — not the other way around.

---

## 15. No Cross-Tier Leakage

A file must belong clearly to one of:

* Domain
* Application
* Infrastructure
* UI

A file must not mix these concerns.

If it does, split it.

---

## 16. Boundary Clarity Rule

When crossing architectural boundaries:

* Use explicit adapter functions.
* Name boundary-crossing functions clearly.
* Do not inline boundary transformations.

Example:

Bad:

```js
const result = derive(plan, document.querySelector(...));
```

Good:

```js
const domState = readDomState();
const result = derive(plan, domState);
```

Boundary crossings must be visible.

---

## 17. Inversion of Control Rule

Inner layers must not instantiate outer-layer objects directly.

Use:

* Dependency injection
* Function parameters
* Explicit adapters

No `new InfrastructureThing()` inside domain.

---

## 18. Testability Rule

Every domain and application function must be testable:

* Without DOM
* Without browser APIs
* Without external services

If it cannot be tested in isolation, it violates architecture.

---

## 19. Framework Independence Rule

The system must not be structurally dependent on:

* React
* Angular
* Bundlers
* Build tools

If introduced, they must remain replaceable.

The architecture must survive their removal.

---

## 20. Determinism Priority Rule

Given the same input, the same inner layers must produce the same output.

Randomness, time, and environment must be injected, not accessed implicitly.

