# Authoring guide — Product requirements (PRD)

Read this before adding to or revising the optional PRD register (`<name>.prd.json`). Craft guidance; the
enforced rules are `prd-referential-integrity` and `prd-coverage` (active only when a PRD register exists).

## Purpose

A PRD item is **product intent / a user need** — the "why" above the software requirements. It is the
upstream anchor of the trace matrix (user need → requirement → verification) and the target a *validation*
test traces to. An SRS requirement traces up to it via `satisfies` (by id). PRD is optional; a project
without one pays no PRD governance.

## What to capture

- **Product-level intent**, not software behavior. A PRD item answers "what should the product do for whom,
  and why" — the SRS answers "what shall the system do." If it reads like a `shall` about a function, it's
  probably an SRS requirement, not a PRD item.
- **Durable need**, not a task or a roadmap status update. PRD items outlive the jobs that implement them.
- A **`status`**: `implemented` (realized — must trace down to ≥1 SRS requirement) or `proposed` (approved
  intent not yet allocated; roadmap/vision, exempt from coverage). New items default to `proposed`.

## How to phrase / derive

- Phrase at the **user/product altitude**: "Users shall be able to …", "The product shall provide …".
- **Derive from the job description** (and any ingested tracker context) — the intent expressed when work
  starts *is* the product requirement. Propose it; let the user ratify. **Do not auto-finalize a PRD item
  from code** — code tells you *what* the system does, never the market/user *why*. PRD drafts lean on the
  conversation and need more human confirmation than SRS drafts.
- Promote `proposed` → `implemented` only once real requirements satisfy it.

## ✅ Good examples

- "Every change to product behavior shall be traceable to an authorized unit of work and the commits that
  implemented it." (`implemented`) — a genuine product need; satisfied downstream by the jobs requirements.
- "SpecPad shall import an existing project's design history, baselining everything at a version tag."
  (`proposed`) — approved intent, not yet built; correctly marked roadmap so it isn't a false gap.

## ❌ Bad examples (and why)

- "The `satisfies` field shall be a string array of ids." — ❌ that's a software/schema requirement (SRS),
  not product intent. Wrong register.
- "Implement the PRD editor next sprint." — ❌ a task/roadmap note, not a durable need. Tasks live in jobs.
- An `implemented` PRD item with no requirement that `satisfies` it — ❌ violates `prd-coverage`; either
  mark it `proposed` (if genuinely unbuilt) or add the requirement that realizes it.
- Mirroring a Jira epic's full body/comments into the register — ❌ store the *need* (the trace anchor),
  not the tracker's churn.

## Common mistakes

- **Collapsing PRD into jobs.** A job is a unit of *change*; a PRD item is a unit of *intent*. A job
  implements PRD items; it is not one.
- **Over-claiming coverage.** Don't mark things `implemented` to silence the gap list — `proposed` is the
  honest home for vision, and the Auditor view shows it as roadmap.

See also: `guides/requirements.md` (the requirement that `satisfies` a PRD item).
