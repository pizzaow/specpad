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

## Category — walk all twelve, once

Each requirement carries `category`: which of IEC 62304 §5.2.2 a)–l) it is. **A list, not one
value** — A1:2015 adds NOTE 10 saying plainly that *"the requirements in a) through l) can
overlap"*. A warning raised over a network link is `alarms`, `it-network` and `functional` at once,
and forcing a single choice makes someone pick arbitrarily, which quietly under-counts the sweep.

| | Category | Ask |
|---|---|---|
| a | `functional` | What the software does — the bulk of most registers |
| b | `inputs-outputs` | Ranges, units, accuracy and limits on every input and output |
| c | `interfaces` | Interfaces to other systems |
| d | `alarms` | Alarms, warnings and operator messages |
| e | `security` | Authentication, authorization, confidentiality, integrity, malware protection |
| f | `user-interface` | What the interface must do so a user does not err — not "it shall be intuitive" |
| g | `data-definition` | Data definitions and database requirements; retention and format |
| h | `installation` | Installation and acceptance at the site where it will run |
| i | `operation-maintenance` | How it is operated and maintained in service |
| j | `it-network` | Networked alarms, protocols, and what happens when the network is unavailable |
| k | `user-maintenance` | What the *user* must do to maintain it |
| l | `regulatory` | Imposed by regulation or by a standard the product claims |

Setting the field on an item is trivial. **The reason it exists is the sweep**: go through all twelve
with the system in front of you and ask *"is there really nothing here?"* — the same move STRIDE makes
in the threat model. **A category with no requirement is a question, not an omission**, and the answer
is often "nothing, because …", worth writing down once rather than rediscovering at review.

The ones a first draft nearly always misses are `alarms`, `installation`, `operation-maintenance`,
`user-maintenance`, `it-network` and `data-definition` — because they describe the product's life
rather than its behaviour, and a conversation about building something rarely reaches them. Ask about
them explicitly.

Two the amendment changed, worth knowing if you learned the 2006 list: f) is **user interface
requirements implemented by software** (it was usability engineering), and j) is **IT-network
aspects** — which, for anything connected, is a category most registers should not be empty on.

`category` is a closed list, and deliberately the only label an item carries. A free-form tag beside it
would compete for the same job and lose: against free text an absent category and a misspelt one look
identical, which is exactly what the coverage question cannot tolerate. Grouping by subsystem is what
**headings** are for.

**Set it on every requirement you write.** The rule is advisory so that established registers are not
lit up overnight; that is a concession to existing projects, not permission for a thin new draft.

## How to phrase

- Start from the subject and use **"shall"**: "The editor shall …", "The skill shall …".
- Be **specific and falsifiable** — name the trigger, the actor, and the observable result.
- **Atomic**: avoid "and"/"or" that smuggle in a second rule. Split them.
- Prefer present, declarative phrasing; avoid "should", "may", "will" for normative rules.
- Reference other items by their **stable id** (`verifies`, `satisfies`), never the human `code`.
- Give it a `code` that reads well in a trace matrix (e.g. `EDS-4`, `JOBS-7`); group with a heading.

## Cite what it rests on

Record in `cites` what the requirement is based on, so a later reader can **open it instead of
believing you**. This is the field the audit works from: an auditor with citations checks a claim,
an auditor without them re-reads the register and agrees with it.

Cite whichever of these apply — usually one or two, not a bibliography:

| Cite | As | Why |
|---|---|---|
| The construct that implements it | `src/shared/governance.ts:checkAdvice` | An audit can open it and see whether it still does this |
| The clause that demands it | `IEC 62304 §5.2.2 c)` | Free text; the audit reads it, a checker cannot |
| The decision it came from | `docs/design/specpad-v1-design.md` | Where the *why* is, which code cannot tell you |

**Anchor on the construct's name, never a line number.** `governance.ts:checkAdvice` survives every
edit except the rename that genuinely invalidates it — which is precisely the event worth being told
about. `governance.ts:240` is falsified by an edit three functions above it, so it decays into noise
and stops being read. A cited path that no longer exists, or a symbol that has been renamed away, is
a hard failure: the requirement claims evidence that is not there.

Cite the **narrowest true thing**. `src/` is not a citation. Nor is the file a requirement merely
sits near — cite what the requirement is *about*. The commonest failure is citing the module a
reviewer would guess at rather than the function that actually decides the behaviour, which produces
a register that looks checkable and is not.

A requirement with no citation is not wrong, and `srs-cites` is advisory for that reason. But
prefer to write one: it is far cheaper now, while you know why, than for the person auditing it in
eighteen months.

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
