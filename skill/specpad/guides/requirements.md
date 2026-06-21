# Authoring guide — Requirements (SRS)

Read this before writing or revising SRS requirements. It is craft guidance, not policy; the enforced
rules live in `checkGovernance` (`traceability`, `referential-integrity`). Keep it ~skimmable.

## Purpose

An SRS requirement is a **durable, testable statement of externally-observable behavior or a governing
constraint** — "what the system *shall* do." It is the design input that a verification test proves and
that source code implements. It is read by engineers maintaining the system and exported as design-control
evidence — so it must be true, singular, and checkable.

## What to capture

- **One behavioral rule per requirement.** If you'd write two tests for it, it's two requirements.
- **Externally-observable behavior or an invariant** — what an outside observer (a user, a caller, a
  downstream system) can see, or a constraint the system must always hold.
- **The "shall" altitude** — the level a reviewer cares about, not the code-structure level.
- Capture **intent, not transcript.** Distill what the user settled on; drop exploratory back-and-forth
  that didn't land and incidental implementation choices.

The litmus test: *could I write a test that fails if this behavior regressed?* If yes, it's a requirement.
If the only test you can imagine asserts how the code is structured, it's not.

## How to phrase

- Start from the subject and use **"shall"**: "The editor shall …", "The skill shall …".
- Be **specific and falsifiable** — name the trigger, the actor, and the observable result.
- **Atomic**: avoid "and"/"or" that smuggle in a second rule. Split them.
- Prefer present, declarative phrasing; avoid "should", "may", "will" for normative rules.
- Reference other items by their **stable id** (`verifies`, `satisfies`), never the human `code`.
- Give it a `code` that reads well in a trace matrix (e.g. `EDS-4`, `JOBS-7`); group with a heading.

## ✅ Good examples

- "The editor **shall** flag a test whose `verifies` reference does not resolve to a requirement."
  — single, observable, testable; one assertion.
- "Every commit that changes requirements or tests **shall** reference at least one open job; a pre-push
  gate **shall** block any pushed commit that lacks a Job reference." — a constraint + its enforcement,
  both observable. (Borderline two-part; acceptable because the second clause is the mechanism for the
  first. If they drift apart, split them.)
- "A job's version **shall** be derived from the release tag whose commits contain it (Unreleased until
  then), not hand-set." — captures an invariant and explicitly excludes the wrong implementation.

## ❌ Bad examples (and why)

- "The store uses a `Map` keyed by id." — ❌ implementation detail, not behavior; no externally-observable
  rule. Rephrase to the behavior that matters: "Lookups by id shall be unique and stable across a save."
- "The editor should be fast and user-friendly." — ❌ unfalsifiable; no test can fail on it. Replace with a
  concrete, measurable behavior (e.g. "shall render the redline without a full reload").
- "The system shall validate input **and** show errors **and** save to disk." — ❌ three rules in one;
  split into three requirements, each with its own test.
- "Refactor `LocalApp` to extract a hook." — ❌ a task, not a requirement; tasks live in jobs/commits, not
  the SRS. The requirement is the behavior that must still hold after the refactor.

## Common mistakes

- **Documenting after the fact.** Capture spec-first, alongside the work — not in a batch at the end.
- **Wrong granularity.** Too coarse hides untested behavior; too fine bloats the matrix. One rule per item;
  surface what you captured so the user can correct granularity (the cheap fix).
- **Stating the "how".** If a reviewer wouldn't care, it's not a requirement.
- **Orphan requirements.** Every non-heading requirement needs ≥1 verifying VTP test (`traceability`).

See also: `guides/tests.md` (the verifying test), `guides/product-requirements.md` (the user need this
requirement may `satisfies`).
