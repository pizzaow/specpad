---
name: specpad
description: Use when creating or maintaining structured software documentation — requirements (SRS), verification tests (VTP), and a project index — as governed JSON in the repo's docs/specpad/ folder. Triggers on "add a requirement", "write tests for", "set up specpad", "check traceability".
---

# SpecPad

Create and maintain SpecPad documents: a project index, an SRS (requirements), and a
VTP (verification tests), stored as JSON under `docs/specpad/` and edited either by you
or by humans in the hosted editor. One shared contract governs both.

## Files and naming

- `docs/specpad/<name>.proj.json` — project index
- `docs/specpad/<name>.srs.json` — requirements
- `docs/specpad/<name>.vtp.json` — verification tests
- `docs/specpad/index.html` — generated launcher (opens the hosted editor)

Every file carries `"schemaVersion": "1.0"`.

## Scaffolding a new project

1. Create `docs/specpad/` if missing.
2. Copy the four templates from this skill's `templates/` folder, replacing every
   `PROJECT_NAME` token with the system's short name.
3. Validate (see "Validate before finishing").

## The v1 shape

Shared envelope on every file: `schemaVersion` ("1.0"), `type`
("project" | "srs" | "vtp"), `name`, `title`.

SRS item — REQUIRED `id`, `text`. Optional `code`, `tags`, `hazards`, `heading`.
VTP item — REQUIRED `id`, `text`. Optional `code`, `verifies`, `expected`, `result`,
`notes`, `tags`, `heading`. `result` is one of "" | "not_tested" | "passed" | "failed".

## Stable ids (critical)

- Every item has a stable `id`, generated once and **immutable**.
- Format: a typed prefix + 6 random hex digits — `r_` for requirements, `t_` for tests,
  `h_` for headings (e.g. `r_7f3a9c`, `t_a12b`).
- Generate by picking 6 random hex digits; if the id already exists in that file, pick
  again. Never reuse a human label as an id.
- **All references use `id`.** A VTP test's `verifies` array holds SRS item `id`s, never
  their `code` labels. Renaming a `code` must never change an `id` or break a reference.

## Never store derived data or history

- Do NOT add `numTests`, result roll-ups, `modifiedUser`, `modifiedDate`, or change
  counters. Git owns history; roll-ups are computed on read.

## Governance — enforce before finishing

These rules are the contract. They mirror the shared validation module exactly; keep them
in sync. Run them mentally (or with the editor) and fix or report every violation before
declaring a task done:

- `traceability`: Every non-heading SRS requirement is referenced by at least one VTP test.
- `referential-integrity`: Every VTP `verifies` entry resolves to an existing SRS item id.
- `missing-expected`: Every non-heading VTP test has a non-empty `expected` value.

Also confirm structural validity: required fields present, `result` within its enum,
`schemaVersion` is "1.0".

## Validate before finishing

Before ending any task that touched these files:
1. Re-read each changed JSON file and confirm it parses.
2. Confirm required fields and the `result` enum.
3. Run the three governance rules above across the SRS+VTP pair.
4. Report any remaining violations to the user (warnings don't block saving, but do block
   "done").
