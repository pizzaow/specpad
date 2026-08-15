# Authoring guide — Review passes

Read this before reviewing a document you or a tool has just produced. These passes are craft, not
policy: governance checks that a document is well-formed and linked, and cannot tell you it is *true*.

## Why a separate pass, and why it must not see your reasoning

Reviewing your own work in the context that produced it is the weakest check available. You already
believe the reasoning — re-reading mostly confirms it. The value comes from a reader who has the
**artefact and the sources** and nothing else.

So each pass runs as a **sub-process with a fresh context**. Give it:

- the artefact under review (the requirements, the section, the risk — the text itself);
- the sources it needs (the code paths, the test files, the standard, the guide);
- the role and the function, from below.

**Never give it the reasoning behind the artefact.** A reviewer told *why* you did something will
agree that you did it. If a design decision genuinely needs explaining for the review to make sense,
that is a signal the artefact does not stand on its own — fix the artefact.

Where sub-processes are not available, run the pass yourself against a **re-read of the sources**
rather than of your notes. It is weaker; say so when you report.

## The passes

Run them in this order. Each is cheap to skip and expensive to have skipped.

### 1. Author — produce, and cite

The generative pass. Whatever you write, record **what it is based on**: the file and construct, the
test that pins it, or the clause of the standard. A claim with no source cannot be checked by anything
downstream, which makes the three passes below guesswork.

### 2. Auditor — is the citation true?

> **Role.** You verify citations. You are given a set of claims, each with the source it cites. You
> have no stake in the document being right.
>
> **Function.** For each claim, open the cited source and decide whether it says what the claim says
> it says. Report `confirmed`, `contradicted`, or `unverifiable` with the reason. Quote the passage
> you relied on. **The document under review is never evidence for itself.**
>
> **Stop when** every citation has a verdict.

The highest-value pass, because it is the closest to mechanical and citation drift is silent. A
standard supersedes, a clause is renumbered, an amendment renames an item, and the document goes on
asserting the old thing with total confidence.

### 3. Adversary — is the approach wrong?

> **Role.** You argue the document is wrong. Not that it is incomplete — that it took the wrong shape.
>
> **Function.** Challenge the decomposition, the altitude, and the targets. Is this one requirement or
> three? Does this trace point at the section that actually implements it, or one that merely sounds
> right? Is this a requirement at all, or a task? For every objection **name the specific alternative**
> — an objection with no proposed replacement is an opinion.
>
> **Default to objecting.** Where you are unsure whether something is right, say it is wrong and let
> the author defend it.
>
> **Stop after** two rounds with no new objection.

The pass that catches a reference which resolves and is still wrong — the failure governance cannot
see, because referential integrity checks that a target exists, not that it is the right target.

### 4. Examiner — what did the code handle that the document does not mention?

> **Role.** You find the cases nobody wrote down.
>
> **Function.** For one item at a time, read the implementation and the tests around it. Enumerate the
> guard clauses, the `throw`s, the clamps, the retries, the defaults, the early returns and the
> boundary checks — and for each, say whether the document accounts for it. **Every finding names the
> construct it came from**: a line, a branch, a test name.
>
> **Stop when** a round produces no finding that names a source.

That stop condition is the whole discipline. "Are there more corner cases?" has no natural end, and a
model asked it will keep producing plausible ones. Bounding the loop on *evidence* rather than on
satisfaction is what stops the pass manufacturing requirements nobody can verify.

## What a pass returns

Findings, not prose. Each one:

| | |
|---|---|
| `claim` | The thing under review, quoted or referenced by id |
| `verdict` | `confirmed` · `contradicted` · `unverifiable` · `objection` |
| `evidence` | The passage, line, construct or clause it rests on |
| `proposal` | What to do instead — required for an objection |

Then **act on them in the same job**. A finding recorded and not resolved is worse than no pass: it
reads, later, as something someone already looked at and accepted.

## When to run which

| Moment | Passes |
|---|---|
| **Baseline** (adopting an existing codebase) | All four. One-off, high stakes, and the output is a scaffold nobody has read yet. |
| **A new pillar** (risk, threats, SOUP) | Author, Auditor, Adversary. These carry the most citation weight. |
| **Working loop** (an ordinary job) | Author, plus Examiner on whatever the job touched. A human is already in this loop; four passes on every job is a cost that repeats forever. |
| **Before a submission** | All four, over everything. This is the moment the cost is obviously worth paying. |

## ❌ How these passes fail

- **Passing the reasoning along.** The commonest, and it silently converts a review into agreement.
- **A pass that finds nothing, accepted at face value.** Ask what it examined. A pass that examined
  three things and found nothing is not the same as a clean document.
- **Findings filed rather than fixed.** See above: an unresolved finding is evidence of neglect, not
  of diligence.
- **An unbounded Examiner.** Without the names-a-source rule it invents cases, and invented cases
  become requirements nobody can test — the exact failure that put "asserted, not measured" in this
  project's own gap register.
- **Running them on a document nobody will read.** These passes cost real time. Spend it on the
  registers a reviewer will actually open.

See also: `guides/requirements.md` (the altitude the Adversary judges against), `guides/tests.md`
(what the Examiner's findings should become).
