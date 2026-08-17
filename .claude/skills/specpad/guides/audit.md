# Authoring guide — The audit

Read this before running `specpad audit`. The audit is the check that runs **on the whole register at
once**, separately from any job, to answer one question: *is this still true?*

It exists because a register drifts in a way nothing else can see. Governance checks that a
requirement is well-formed, linked and verified — all of which stay true while the requirement
becomes false. Every stale requirement found in SpecPad's own register still resolved, still had a
test, and still passed.

## Why the mechanical checks are not enough (this was measured, not assumed)

Three cheap proxies for "this requirement no longer matches the code" were built and run against a
register with eighteen known-stale requirements:

| Proxy | Result |
|---|---|
| Requirement unchanged while the code it traces to changed | 176 flagged, 9 of 18 caught |
| The traced source last changed *after* the requirement was written | 278 of 316 flagged |
| An identifier named in a requirement no longer appears anywhere | 1 finding, and it was false |

All three fail for one reason: **the finest trace a register holds is a file**, and the busy files
change in nearly every job, so everything pointing at them is permanently suspect. A check that flags
278 of 316 is not a check — it is the flag day that teaches people to ignore the tool.

So the audit has to read. That costs real time, which is why everything below is about **bounding**
it rather than about being thorough.

## Stage 1 — the mechanical part, first and always

Cheap, deterministic, and it narrows what the reading stage must cover. Run all of it before spending
a single sub-process:

1. **Governance** — must be clean. An audit over a register with open violations is measuring the
   wrong thing.
2. **Citations** — resolve every `cites` entry that names a repository path (`checkCitations` in the
   shared contract). A cited file that is gone, or a symbol renamed away, is a **hard failure**: the
   requirement claims evidence that is not there. This is the one mechanical drift check that works,
   because it matches an exact name rather than guessing from a file's mtime.
3. **Citation coverage** — report it as a number, always, including 0%. The `srs-cites` advisory
   stays quiet for a register that cites nothing (adoption, as every advisory rule treats it), so the
   audit is where that project hears how much of itself is checkable. Coverage is also the honest
   ceiling on this audit: what is uncited was re-read, not verified.
4. **Advisories** — read them, and say which the audit is choosing not to act on. Silence is
   indistinguishable from having looked.
5. **Test references** — every VTP `notes` naming an automated test resolves to a test that exists.

Report these findings as findings. They need no judgement and no sub-process.

## Stage 2 — the reading part, under a contract

Run as **sub-processes with fresh context**, one batch of requirements each, given the requirements,
their citations, and the cited sources — and **never the reasoning that produced them** (see
`guides/review-passes.md`; a reviewer told why you did something will agree that you did it).

### The finding contract

> **A finding must quote the current source that contradicts the claim. No quote, no finding.**

This is the whole design, and it is not a style preference. An audit asked "is this right?" is
unbounded, and a model asked an unbounded question produces plausible findings indefinitely — a real
run over 316 requirements returned 237 findings of which roughly 150 were two observations restated.
Asked instead "can you produce the contradiction?", it either can or it cannot, and both answers are
useful. Every finding that survived that run came with a line somebody could open.

The quote must be **current source**, not the register. The document under review is never evidence
for itself.

### What each sub-process is asked

> **Role.** You audit a requirements register against the system it describes. You did not write it
> and you have no stake in it being right.
>
> **Function.** For each requirement you are given: open the sources it cites and the code it traces
> to, and decide whether the requirement is still true of the system as it is now. Return `holds`,
> `contradicted`, or `unverifiable`.
>
> - `contradicted` **requires a verbatim quote** of the source that contradicts it, and the path it
>   came from. Without a quote, return `holds`.
> - `unverifiable` means the requirement names nothing you can check — report it as a citation gap,
>   not as an error in the requirement.
>
> **Do not** report that a requirement should be split, reworded, or given more tests. That is
> authoring advice, and it is not what this pass is for.
>
> **Stop when** every requirement has a verdict.

That last exclusion matters as much as the contract. Without it the audit fills up with drafting
opinions, which are unbounded, unfalsifiable and drown the handful of findings that say something is
actually wrong.

### Audit the register against itself, too

One batch that reads the register alone, looking for requirements that **contradict each other**. No
code is needed and it is cheap. Real examples from SpecPad's own register, both shipped, both invisible
to governance:

- one requirement cited a regulation that another requirement explicitly forbade citing;
- one described an element as "not yet built" while another derived that element's status from a
  register that existed.

## What the audit produces

A table, ordered by severity, each row acting on one finding:

| | |
|---|---|
| `requirement` | The code |
| `verdict` | `holds` · `contradicted` · `unverifiable` |
| `quote` | The verbatim source that contradicts it — **required** for `contradicted` |
| `where` | The path it came from |
| `proposal` | The corrected wording, or the decision the user must make |

Then **fix what it found, in the same job**. A finding recorded and left reads later as one somebody
already considered and accepted — which is worse than never having looked.

Some findings are not the audit's to resolve: a requirement describing functionality the code refuses
to perform is either a wrong requirement or a missing feature, and only the user can say which. Put
those in front of them as a decision rather than guessing.

## When to run it

**Before cutting a release.** That is the moment the register stops being a working document and
becomes the evidence somebody else relies on, and it is the last point at which a correction is
cheap. A release whose audit has open unreviewed findings should not be cut.

Not on every job — the cost repeats forever and a human is already in that loop. The working loop's
Author and Examiner passes cover a job's own changes; the audit catches what those passes cannot,
which is a requirement falsified by a change made *somewhere else*.

## ❌ How the audit fails

- **Dropping the quote requirement.** It degrades into drafting opinions within one batch. Everything
  else here depends on this holding.
- **Auditing against the register instead of the source.** The register agrees with itself; that is
  what made it possible to ship eighteen false requirements with governance clean throughout.
- **Passing the reasoning to the sub-process.** Converts the audit into agreement, silently.
- **A clean audit accepted at face value.** Ask what it opened. A pass that read three files and found
  nothing is not the same as a register that is true.
- **Treating `unverifiable` as `holds`.** It is a citation gap and it is the audit telling you where
  it could not do its job — which is exactly what to fix before the next one.

See also: `guides/review-passes.md` (the per-job passes and why a reviewer must not see the
reasoning), `guides/requirements.md` (how to cite, so the audit has something to open).
