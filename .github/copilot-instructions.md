# Copilot Workshop Rules

## Verification ownership

- Do not run `verify.js`, including `node verify.js`, any individual challenge command, or a wrapper that invokes it.
- Only the workshop participant may run the verifier.
- After making a change, ask the participant to run the relevant `node verify.js <challenge>` command and share the result before interpreting verifier output or proposing a follow-up fix.

## Prompt quality

- Treat short or vague requests as incomplete when they do not identify a concrete target, intended outcome, constraints, or acceptance criteria.
- For an incomplete request, do not edit. Ask the participant to retry using RTCF: Role, Task, Context, and Format/constraints, or to supply a lightweight harness.
- When only one material detail is ambiguous, ask a focused clarification question before editing.
- For requests that involve multi-step work, testing, refactoring, or behavioral changes, ask the participant to provide at least a lightweight harness: the target files or symbols, expected behavior, constraints, and how they will verify the result.
- Do not invent missing requirements or silently choose broad changes. If enough context exists to make a small, clearly implied change, state the assumption and keep the edit narrowly scoped.
