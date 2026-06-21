# Authoring guide — Verification tests (VTP)

Read this before writing or revising VTP tests. Craft guidance; the enforced rules are in
`checkGovernance` (`referential-integrity`, `missing-expected`).

## Purpose

A VTP entry is the **verification** that a requirement is met: a procedure plus the **expected result**
that defines a pass, linked to the requirement(s) it proves via `verifies` (by id), and — where the
behavior is automatable — mapped to the real automated test that exercises it. It is the evidence half of
the trace chain requirement → verification.

## What to capture

- **The procedure** (`text`): what to do to check the requirement — concrete enough to repeat.
- **The expected result** (`expected`): the observable outcome that *defines a pass*. Never blank for a
  non-heading test (`missing-expected`). "It works" is not an expected result.
- **`verifies`**: the **id(s)** of the requirement(s) this proves (never the `code`).
- **The automated test** where automatable: name the real test (e.g. the vitest file) in `notes`, and set
  `result` to reflect it (`passed`/`failed`). Where there is no automated test yet, record it as
  `not_tested` rather than omitting the gap.

## How to phrase

- Write the procedure as an **action**: "Render the view tabs and …", "Confirm that …".
- Write `expected` as a **checkable assertion**: a specific state, value, or message — the thing a reviewer
  (or a test runner) can compare against.
- One test should prove one requirement cleanly; a test may `verifies` several only when it genuinely
  exercises each.
- Keep `expected` independent of *how* it's implemented — assert the outcome, not the internals.

## ✅ Good examples

- Procedure: "Render the Releases view with releases and versioned jobs."
  `expected`: "Each release shows newest-first with version/date/author and its jobs grouped
  Features/Bugfixes; closed jobs with no version appear under Unreleased; open jobs are excluded."
  `notes`: "src/components/__tests__/ReleasesView.test.tsx", `result`: passed. — concrete, asserts the
  observable outcome, mapped to a real test.
- Procedure: "Confirm a satisfies reference that does not resolve raises prd-referential-integrity."
  `expected`: "checkGovernance returns a prd-referential-integrity violation naming the requirement." —
  one requirement, one falsifiable outcome.

## ❌ Bad examples (and why)

- `expected`: "Works correctly." — ❌ not checkable; defines no pass criterion. Say *what* correct means.
- `expected`: "" (blank) on a real test — ❌ violates `missing-expected`; a test with no expected result
  proves nothing.
- `verifies: ["EDS-4"]` (a code, not an id) — ❌ references must target the stable id (e.g. `r_ed0b04`);
  codes are renameable and would break the link.
- Procedure: "Test the editor." — ❌ no procedure; says nothing repeatable. Name the action and the input.
- Marking `result: passed` with no `notes` evidence — ❌ a pass with no covering test or recorded evidence
  is unverifiable. Cite the automated test or the manual check.

## Common mistakes

- **Expected = restated requirement.** The expected result is the *observable signal of a pass*, not a
  paraphrase of the requirement.
- **Silent gaps.** A behavior with no test is a `not_tested` gap to record, never an omission.
- **Stale `notes`.** If the named test is renamed or removed, the reference dangles — fix it (the audit
  flags this).

See also: `guides/requirements.md` (the requirement this verifies).
