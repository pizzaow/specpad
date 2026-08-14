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

## One requirement is not one test

**A near 1:1 register of requirements to tests is the commonest failure in a verification protocol,
and it is invisible** — every requirement is verified, governance is clean, coverage reads 100%. What
it means is that every requirement has been shown to work *when nothing goes wrong*, which is the
weaker half of the claim.

Verify a requirement the way you would try to break it:

| | |
|---|---|
| `nominal` | The behaviour the requirement describes, under the conditions it assumes. Usually **one or two** — the ordinary case and the one interesting variant. |
| `boundary` | The edges of the accepted range, and **which side of each edge is accepted**. Where a requirement names a limit, this is not optional. |
| `negative` | Invalid input, refused operations, error paths. What the system **will not** do, and what it says when it will not. |
| `stress` | Volume, concurrency, exhaustion, sustained load — where the requirement implies a capacity or a shared resource. |
| `security` | Testing in a security context, beyond ordinary verification — see below. |

Not every requirement earns all five. A requirement with no range has no boundary; a pure function has
no stress case. But **a requirement with only nominal tests is a question**: what happens when the
input is wrong? Answer it, or say why the question does not arise.

The rule of thumb that produces a real protocol: *one nominal test proves the feature exists; the
others prove it is safe.*

> ✅ A requirement that a rate is range-checked: nominal (a valid rate is accepted), boundary (0.1 and
> 99 accepted, 0.09 and 99.1 refused), negative (a non-numeric input is refused and the prior value
> kept), stress (a thousand submissions in a second does not admit one through).
> ❌ The same requirement with one test: "enter a valid rate, it is accepted."

`vtp-negative-path` advises on a requirement whose tests are all nominal, once the register has begun
classifying its tests at all.

## Security testing (FDA §V.C)

FDA is explicit that **cybersecurity controls need testing beyond standard verification and
validation** (*Cybersecurity in Medical Devices*, February 2026, §V.C). Where a project has a threat
model or any security requirement, record which type each security test is in `securityTest`, so that
a reviewer asking "show me your fuzz testing" is answered by a filter rather than a search.

| Group | Types |
|---|---|
| **Security requirements** | `security-requirements` — each security requirement implemented, **with the boundary analysis and the rationale for the boundary assumptions** |
| **Threat mitigation** | `threat-mitigation` — each risk control effective against the threat model's views, and adequate under maximum load |
| **Vulnerability testing** (ANSI/ISA 62443-4-1) | `abuse-case`, `malformed-input`, `robustness`, `fuzz`, `attack-surface`, `vulnerability-chaining`, `known-vulnerability-scan`, `composition-analysis`, `static-analysis`, `dynamic-analysis` |
| **Penetration testing** | `penetration` |

Two things the guidance asks for that are easy to omit:

- **Who tested, and how independent they were** from the people who designed it. Record it in `notes`;
  for a third-party report, keep the original.
- **An assessment of every finding**, including a rationale for anything not implemented or deferred to
  a later release. A finding with no disposition reads as a finding nobody looked at.

`static-analysis` explicitly includes testing for credentials that are hardcoded, default, easily
guessed or easily compromised — worth naming as its own test rather than assuming a linter covers it.

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
