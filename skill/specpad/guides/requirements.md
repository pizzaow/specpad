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

## Category — walk the nine, once

Each requirement carries a `category`: which of IEC 62304 §5.2.2 a)–i) it is. Setting it on an item is
trivial. **The reason it exists is the sweep**, and the sweep is what you owe the draft:

| Category | Ask |
|---|---|
| `functional` | What the software does — the bulk of most registers |
| `inputs-outputs` | Ranges, units, accuracy, limits on every input and output |
| `interfaces` | Interfaces to other systems, devices and software |
| `alarms` | Alarms, warnings, and operator messages |
| `security` | Authentication, authorization, confidentiality, integrity, audit |
| `usability` | What the software must do so a user does not err — not "it shall be intuitive" |
| `data-definition` | Data definitions and database requirements; retention and format |
| `installation` | Installation and acceptance at the point of use |
| `maintenance` | Operation and maintenance by the user, including servicing |
| `regulatory` | Requirements imposed by regulation or by a standard the product claims |

Go through all ten with the system in front of you and ask *"is there really nothing here?"* — the same
move STRIDE makes in the threat model. **A category with no requirement is a question, not an
omission**, and the answer is often "nothing, because …", which is worth writing down once rather than
rediscovering at review.

The categories a first draft nearly always misses are `alarms`, `installation`, `maintenance` and
`data-definition` — because they describe the product's life rather than its behaviour, and a
conversation about building something rarely reaches them. Ask about them explicitly.

**Set it on every requirement you write.** The rule is advisory so that established registers are not
lit up overnight; that is a concession to existing projects, not permission for a thin new draft.

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
