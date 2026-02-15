# FrameSmith Coding Style

This document defines coding style rules for the FrameSmith codebase.

## Goals

- Keep code readable by humans first.
- Prefer explicit, boring code over clever code.
- Keep control flow obvious.
- Keep architecture intent in docs, not hidden in tricks.

## Core Rules

1. No ternary operators in control flow.
2. Named functions by default.
3. Avoid anonymous functions when a named function is practical.
4. Avoid IIFEs unless isolation is strictly required.
5. Prefer object parameters for named arguments.
6. Keep functions small with explicit input and output.
7. Keep side effects at boundaries (UI/event layer); keep core logic pure.
8. If a block needs explanation, extract it into a named function.
9. Use doc comments to explain intent and constraints.
10. Do not use deep nesting when a guard clause can flatten flow.

## SOLID Rules

Apply SOLID as practical engineering guidance, not as theory-only language.

1. Single Responsibility:
- A module/class should have one clear reason to change.
- If a function/class needs many unrelated collaborators, treat it as a refactor signal.
- Event handlers should stay orchestration-only.

2. Open/Closed:
- Extend behavior by adding new modules/ports/adapters, not by patching large switch/if chains in core flow.
- Prefer adding strategy implementations over editing stable orchestration code.

3. Liskov Substitution:
- Implementations behind the same boundary (port/interface) must preserve expected behavior and result shape.
- Do not add hidden special cases that break caller assumptions.

4. Interface Segregation:
- Prefer small, cohesive ports over broad "god" dependency bags.
- Group dependencies by concern (planning, decoding, encoding, reporting, etc.).

5. Dependency Inversion:
- Core orchestration depends on abstractions/ports.
- Composition root (`script.js`) wires concrete implementations.
- Keep browser/runtime specifics at boundaries.

### SOLID Smell Checklist

- Constructor or function needs many unrelated dependencies.
- A class both orchestrates flow and performs low-level codec/container details.
- Adding one new behavior requires editing many existing call sites.
- Testing requires heavy setup because boundaries are unclear.

## Event Handlers

- Event handlers should orchestrate, not implement business logic.
- Move non-trivial logic into named helpers.
- Treat large handlers as a refactor target.

## Logging

- Keep logs actionable.
- Remove noisy internal tracing once an issue is resolved.
- Prefer explicit warning/error signals over high-volume debug logs.

## Architecture Notes

- `script.js` is application orchestration glue.
- Deep architecture detail belongs in `docs/`.
- Core logic should live in `src/` modules with tests.
