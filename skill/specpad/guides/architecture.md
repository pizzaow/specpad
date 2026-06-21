# Authoring guide — Architecture (SAD)

Read this before authoring or revising the architecture spec (`<name>.sad.md` + its diagrams). Architecture
is an **optional, tracked-text** spec (arc42 markdown + draw.io SVGs), separate from the id-keyed JSON
contract. It is job/release-coupled — there is **no requirement-to-architecture trace matrix**.

## Purpose

The SAD explains **how the system is built and why** at the level a new engineer or a reviewer needs:
the context, the building blocks and their interfaces, the key runtime flows, and the deployment. It is a
design *output*, co-versioned with the requirements; a job's architecture impact is shown by diffing
snapshots (coarse — file changed yes/no, plus a SAD line diff), not by a per-requirement link.

## What to capture (and what to leave out)

- **Capture the load-bearing decisions**: the major components, the interfaces/contracts between them, the
  flows that matter (the ones an interface or a failure mode hangs on), and where things run.
- **Leave out** what the code already says better (every class, every function). The SAD is the map, not the
  territory — if a detail isn't a decision a reader needs, it belongs in the code, not the SAD.
- Follow the **arc42 skeleton** the template provides; it's fine to omit sections that don't apply — say so
  rather than padding.
- Read the project's soft authoring guide (`<name>.sad.guide.md`) first — it carries this project's
  tone/terminology tact (it steers; it does not enforce).

## Diagrams — earn their place

- **Place diagrams inline from the markdown** with image refs (`![context](<name>.context.svg)`); the
  Display renders each at its spot. draw.io SVG is the pragmatic primary format (renders client-side).
- A diagram should **answer a question prose can't** — prefer a **context** overview near the top, plus
  **building-block** (key interfaces), **runtime** (a process/flow), and **deployment** (where/when). Don't
  add a diagram that just restates a list.
- Per-job diagram change tracking is **coarse** (the file changed) — there is no in-diagram delta. Keep
  diagrams legible; a redraw shows as "changed", which is the intended signal.

## ✅ Good examples

- A **Building Block view** that shows the three modules and labels the **interface** each exposes — the
  thing a caller must honor. — earns its place; conveys contracts.
- A SAD section that states a decision *and its reason*: "Diffs are computed in the editor, not the skill,
  so both halves share one implementation and cannot disagree." — load-bearing rationale.

## ❌ Bad examples (and why)

- A class diagram of every type in a module. — ❌ the code says this better and it rots immediately; not a
  decision a reader needs.
- "The architecture is a React app." with no interfaces, flows, or decisions. — ❌ says nothing load-bearing.
- Trying to maintain a requirement-by-requirement architecture trace matrix. — ❌ explicitly out of scope;
  architecture is coupled at the job/release level, not per requirement.
- A diagram embedded as a PNG screenshot. — ❌ use the draw.io SVG so it renders inline and stays editable.

## Common mistakes

- **Documenting the obvious; omitting the decision.** Reviewers want the *why* and the *interfaces*.
- **Diagram sprawl.** Four purposeful views beat ten that restate each other.
- **Forgetting the snapshot.** On close/refresh the SAD + diagrams are snapshotted into the job/release
  cache so the change shows — keep them in `docs/specpad/` (never gitignored).

See also: the project's `<name>.sad.guide.md` (project-specific tact, surfaced in the editor).
