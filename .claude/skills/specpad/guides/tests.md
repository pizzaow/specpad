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
- **`verificationLevel`**: `unit`, `integration` or `system` — see below.
- **The automated test** where automatable: name the real test (e.g. the vitest file) in `notes`, and set
  `result` to reflect it (`passed`/`failed`). Where there is no automated test yet, record it as
  `not_tested` rather than omitting the gap.

## Verification level — three activities, not one register

IEC 62304 treats unit verification (§5.5), integration testing (§5.6) and system testing (§5.7) as
**three separate activities**, each with its own records. A flat register can show that every
requirement is covered by *something*; it cannot show that each activity happened. `verificationLevel`
is what makes the difference.

| Level | What it exercises | Typical shape |
|---|---|---|
| `unit` | One software unit against its acceptance criteria (§5.5.3) | A test of one module's function, boundaries and error paths |
| `integration` | Units working together, and the interfaces between them (§5.6) | Two or more units, or a unit against a real dependency |
| `system` | The software as a whole against a requirement (§5.7) | Drive it the way a user or a caller does, end to end |

Pick by **what the test exercises, not where the file lives**. A test in a folder called `unit/` that
starts a server and issues HTTP requests is a system test; a test named `integration.test.ts` that
exercises one pure function is a unit test. The folder is a convention; the level is a claim about
scope, and a reviewer reads it as one.

Requirements will usually attract system tests, and units usually attract unit tests — but the interesting
gap is `integration`. Ask directly: *where do two units meet, and what proves that join?* An empty
integration level in a system with several collaborating units is a finding waiting to happen.

**Set it on every test you write.** Advisory means existing registers are not lit up overnight; it does
not mean a new draft may leave it blank.

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
