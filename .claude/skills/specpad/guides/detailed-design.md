# Authoring guide — Software Detailed Design (SDD)

Read this before writing or revising SDD sections. Craft guidance, not policy; the enforced rules live
in `checkGovernance` (`sdd-referential-integrity`, `sdd-coverage`).

## Purpose

The SDD says **how the software is built** — the design that implements the requirements. The SRS says
what the system shall do; the SAD says how it is structured at the top level; the SDD closes the gap
between an architecture block and the code, unit by unit.

It is read by an engineer maintaining the code, and by a reviewer checking that the design implements
the requirements. Both need it to be **true of the code as it is now**.

Regulatory anchors — for context, not for copying into the document:

- **IEC 62304 §5.4** — refine the architecture into software units (§5.4.1); a detailed design for each
  unit (§5.4.2); a detailed design for the interfaces between units and to external components,
  including behaviour for **invalid** parameters (§5.4.3). §5.5.3 wants **acceptance criteria** for a
  unit before it is verified.
- **FDA, *Content of Premarket Submissions for Device Software Functions* (June 2023)** — the Software
  Design Specification must let a reviewer "understand the technical design details" and show the
  design "completely and correctly implements all the requirements of the SRS". Its traceability model
  is hazard → requirement → design → test.
- **IEEE 1016** — the standard that actually defines what a design description *contains*: design
  views, each answering the concerns of a viewpoint. The section skeleton below is drawn from it.

**Author at the maximum level, always.** SpecPad does not gate the SDD on safety class or documentation
level. 62304 makes §5.4.2/§5.4.3 Class C only and FDA submits the SDS only at Enhanced — but deciding
what to *omit* is a job for the export, not for the author. A design you documented and did not need
costs a little time; one you needed and did not document costs a submission.

## Sections and identity

An SDD is an ordered list of **sections**. Each has:

- a stable **`id`**, generated once and never changed — this is what requirements link to;
- a **`code`** and **`title`**, both freely renameable, because nothing references them;
- a markdown **`body`**, which may embed images and diagrams the same way the SAD does
  (`![Sequence](name.svg)` resolves against the project folder);
- optional **`source`** — the repository paths the section describes, which is what makes the design
  checkable against the code.

Rename headings, reorder sections, rewrite bodies wholesale: the links hold, because they are on the
id. That is the whole reason the id exists — do not invent a second identifier and do not reference a
section by its code or title.

## What to capture

Two kinds, and most SDDs need both.

**Unit sections** — one per software unit, the bulk of the document. This is §5.4.2.

**Viewpoint sections** — the cross-cutting views a per-unit walk cannot express (IEEE 1016). Write the
ones that carry information; skip the ones that would be empty:

| Viewpoint | Answers |
|---|---|
| Context | What is outside the software and how it is reached |
| Composition | How units group into the architecture's blocks |
| Dependency | What depends on what, and which way the arrows point |
| Information | The data model, its lifecycle, and where it is persisted |
| Interface | Interfaces crossing a boundary — external, or between blocks (§5.4.3) |
| Patterns | A convention used repeatedly, written once instead of per unit |

A design decision that was hard, contested, or is likely to be revisited deserves its own section
whether or not a viewpoint covers it. That is the section a maintainer will actually come looking for.

## Choosing units — the hard part

62304 says only: *"the granularity of software units is defined by the manufacturer."* A unit is a
software item you have **chosen** not to subdivide. It is a declared boundary, not a discovered one, so
the choice has to be defensible.

Four tests, in order of authority:

1. **What decision does it hide?** Parnas's criterion, and still the best one: a module exists to hide
   a design decision likely to change. Two things that will change independently belong in two units.
   He is explicit that decomposing from the flowchart — the order in which things happen — is *almost
   always wrong*. **This is the mistake to guard against when drafting from code**, because call order
   is the structure a reader most easily sees.
2. **Can it be verified on its own?** A unit you cannot test without standing up half the system is not
   a unit. Independent verifiability is what §5.5 assumes.
3. **Does it stop a risk?** Draw the boundary where a defect's blast radius ends. Isolating safety risk
   is the most useful test when the other two are ambiguous, and it is the one a reviewer cares about.
4. **Does it have an interface?** If nothing crosses a defined boundary, there is no unit — just code.

Practical calibration: **module or cohesive module-file level** is almost always right. A folder of
closely-related files can be one unit. Whole subsystems are too coarse to say anything useful about.

**Teams err toward too granular far more often than too coarse.** A unit per file, or per function, buys
nothing and costs the tracking overhead on every one of them.

## ✅ Good

- *"`merge` — reconciles two edits of the same document. Secret: that reconciliation is item-id-keyed
  rather than textual, so the strategy can change without any caller knowing."* — names the unit, states
  what it hides, and the secret is a real decision that could change.
- A unit section whose body gives the algorithm, the data it owns, what it does with **invalid** input,
  and the acceptance criteria for calling it verified.
- *"Interface: `mergeDocs(base, ours, theirs) → MergeResult`. A document that is not an id-keyed register
  throws rather than being merged textually."* — the invalid-parameter behaviour §5.4.3 asks for.
- One section for a convention used in twenty places ("every id is generated by `ids.ts` and never
  reassigned"), instead of the same paragraph twenty times.

## ❌ Bad (and why)

- *"`utils` — helper functions."* — ❌ hides no decision, has no coherent interface, cannot be verified
  as a thing. A bag of leftovers is not a unit.
- One section per source file across a 200-file tree — ❌ over-granular; most sections will restate the
  filename and nothing else, and every one is now a maintenance obligation.
- *"On submit, the handler calls the validator, then the store, then the renderer."* — ❌ decomposed from
  the call flow. Describes execution order, not design; tells a maintainer nothing about what may change.
- Pasting the function signatures out of the code — ❌ the code already says that, and it will drift.
  Say what the interface *guarantees*, especially when it is misused.
- *"The design is described in the source code."* — ❌ not a design description. If the design is only
  in the code, there is no design input to verify the code against.
- A section that describes an intended future design — ❌ the SDD describes the software as built.
  Intent belongs in a job or a PRD item.

## Linking requirements to the design

The link is on the **requirement**: `SrsItem.design[]` holds SDD section ids. Read it as "this
requirement is implemented by these sections."

- Every requirement should reach at least one section (`sdd-coverage`). A requirement with no design is
  either not implemented, or implemented somewhere nobody wrote down.
- A constraint-style requirement often points at a viewpoint or convention section rather than a unit.
  That is a legitimate answer, not a workaround.
- Do not add a reverse link from the section back to the requirement. One direction, one place to
  maintain; the reverse is derived when the matrix is rendered.

## Keeping it true — the re-review rule

**When you change an SDD section, every requirement that references it is suspect.** The design changed;
whether the requirement is still implemented as written is now an open question.

So, in the same job as the change: list the requirements referencing that section, and for each one
decide whether it still holds. Most will. The ones that do not are exactly the drift this pillar exists
to catch — fix the requirement, or the design, in that same job. `refresh`, the pre-push gate, and the
editor all surface the affected requirement list; deciding is yours.

The same rule in the other direction: a code change with no SDD change is a claim that the design did
not change. Sometimes true. Check the sections whose `source` paths you touched.

## Drafting from existing code

The baseline generator drafts an SDD by reading the repository. It is a **draft**: it can see structure,
and it cannot see intent.

- Propose units from module boundaries — directories and cohesive module files — never one per file
  across a large tree, and never from the call graph.
- For each proposed unit, state the decision it appears to hide, and mark that line for the author to
  confirm. A guess about a secret is the most valuable and least reliable thing in the draft.
- Fill `source` from real paths, so every section is checkable.
- Tag drafted sections `draft` and leave them for review. An unreviewed generated SDD is worse than
  none: it looks like a design input and is really a summary of the code, which cannot verify itself.

See also: `guides/requirements.md` (what the design implements), `guides/architecture.md` (the level
above), `guides/tests.md` (verification).
