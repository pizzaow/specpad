# Authoring guide — SOUP / off-the-shelf software

Read this before adding or revising a component. Craft guidance, not policy; the enforced rules are
`soup-identity`, `soup-requirements` and `soup-referential-integrity`.

## Purpose

The register records **the third-party software the product depends on, and what you know about it**:
exactly which version, what you require of it, what it needs to run, what it is known not to do, and
what happens when the supplier stops.

Two regimes, one record. **IEC 62304** asks what you require of the component (§5.3.3) and
what it needs to run (§5.3.4). **FDA's off-the-shelf software guidance** asks where it came from, why
it is appropriate, what its limits are, how it is tested, and — at Enhanced level — what the
end-of-life plan is. Neither is a subset of the other, so both are
recorded, at maximum rigour. What to omit is an export decision.

## This is not an SBOM

An **SBOM** is a recursive inventory of every dependency, generated from the manifests, and for a
JavaScript project it runs to hundreds of packages. This register is the **assessed subset**: the
components you have actually looked at, formed a view on, and are prepared to defend.

They serve different purposes and they are produced differently. Keep them apart. The failure to avoid
is letting a forty-entry assessed list stand in for a nine-hundred-package inventory.

## What counts

**In:** anything that ships or that the product cannot run without. Libraries linked into the build,
the language runtime, a binary the product invokes at runtime, an operating system component the device
relies on.

**Out:** software used to *develop* the product — compilers, bundlers, test runners, linters, CI. Those
fall under IEC 62304 §5.1.4 (development tools), not SOUP. None of it reaches the user.

The one people miss is the runtime that is not a package: the language runtime, and any binary invoked
as a subprocess. If the product stops working when it is absent, it is SOUP.

## What to capture

| Field | Answers | Source |
|---|---|---|
| `name`, `vendor`, `version` | Exactly what is it | §8.1.2, FDA |
| `releaseDate`, `license`, `url` | Provenance | FDA |
| `purpose` | What it does here, and why it is appropriate | FDA |
| `requirements` | What you require of it, functionally and in performance | §5.3.3 |
| `runtime` | What *it* needs in order to run | §5.3.4, FDA |
| `limitations` | What it is known not to do | FDA |
| `endOfLife` + `endOfLifeSource` | When the supplier stops, and where that came from | FDA (Enhanced) |
| `usedBy`, `tests` | Which units use it; what exercises it | §5.3.3, FDA |
| `maintenance` | Supplier's practices, and this product's plan for when support ends | FDA (Enhanced) |

### The version is exact, and that is the point

A range is not an identity. `^18.2.0` says nothing an auditor can act on: **an assessment applies to
the version it was performed against**, and a range does not name one. "Latest stable" is worse — it
also makes a vulnerability lookup impossible, since there is no version to look up.

Record what is actually installed, and revisit the record when it changes.

### `purpose` — what it does here, and why this one

Three things, in a sentence or two each: the **role** it plays in this product, **why it is
appropriate** for that role, and — where the choice was contested — **why this component rather than
the alternatives**. The last is what the FDA guidance asks for at Enhanced level, and it is the part
that is impossible to reconstruct a year later.

> ✅ *"Validates every document against its JSON Schema. Chosen over hand-written validation because the
> schemas are published as the contract; a second implementation would be a second source of truth."*
> ❌ *"A JSON Schema validator."* — that is the supplier's description, and would be equally true of a
> component that did not suit at all.

### `requirements` — the field auditors read first

What **you require of it**, not what it claims to do. Write them as a list, one per line, each phrased
so that a failure would be recognisable. This is the field most often found insufficient, and for two
reasons that are easy to fix.

**Every performance requirement needs a number.** "Fast enough", "no perceptible delay", "reasonable
memory" cannot be verified and will not survive review. Put a figure and the conditions on it.

> ✅ *"Renders a 250-row register table in under 200 ms on a mid-range laptop."*
> ❌ *"Renders large tables without a perceptible delay."*

**Test the interface, not the internals.** A component is a black box: require behaviour observable at
its boundary, including what happens when it is misused. What it does internally is the supplier's
business and will change without telling you.

> ✅ *"A document with no `items[]` array is rejected rather than merged."*
> ❌ *"Uses an efficient tree-diff internally."*

Where a requirement is exercised by a test, link it through `tests`. A requirement no test reaches is
a finding on its own — the same rule the SRS lives by, for the same reason.

### `runtime` — what *it* needs, stated in versions

Floors and exclusions, not adjectives. Name the versions, and name what is **not** supported: the
exclusion is what someone deploying to an unusual platform needs, and it is never in the supplier's
headline.

> ✅ *"Node 22 LTS or later; POSIX or Windows host; git 2.34+ on PATH. Not supported on Node 20, which
> is out of support."*
> ❌ *"A modern JavaScript environment."*

### `limitations` — what it will not do, and what you do about it

The behaviour you had to work around, the thing it deliberately does not support, the edge it does not
handle. Where you compensate for a limitation elsewhere, say where — that sentence is the one that
answers "so why is this acceptable?" before it is asked.

> ✅ *"Does not render raw HTML by design, so tables require the GFM plugin. Rendering is not
> incremental: a very large document re-renders whole, which is why a section is the editing unit."*
> ❌ *"Some limitations apply."*

### `maintenance` — the supplier, and your contingency

Three parts, and the third is the one people omit:

1. **What the supplier does** — release cadence, security policy, whether there is a notification
   channel or an SLA you can point to. FDA calls this assurance of development and maintenance.
2. **What you do when they stop** — replacement cost, and whether the boundary is narrow enough to
   swap. "This is a wrapper; the core could be used directly" is a contingency. "We would have to
   rewrite the editor" is also a contingency, and an honest one.
3. **When you look again** — the trigger for re-assessment. A major version, a licence change, a
   change of ownership, or a date.

### `endOfLife` — check both sources

The supplier's own announcement is authoritative but often hard to find and sometimes absent.
**[endoflife.date](https://endoflife.date) is the practical second source**: it tracks published
support windows for most runtimes, frameworks and distributions, and will usually give you a date when
the supplier's own pages will not.

Record the date, and put in `endOfLifeSource` where it came from — the supplier's announcement if you
found one, endoflife.date otherwise, and both where they disagree. A date with no source is a claim
about a supplier's intentions with nothing behind it.

If no end of life has been announced, leave it empty. That is a different statement from a date in the
past, and the register shows them differently.

Support windows are **per release line**: a major-version upgrade usually moves the date, so this is
one of the fields to revisit whenever the version changes.

## ✅ Good

- *"Renders CommonMark to React elements. Must not execute embedded HTML, since a specification is
  authored by several people and may be edited through a server."* — a requirement on the supplier that
  a failure would be recognisable against.
- `endOfLife: 2019-07-24` with a link to the supplier's announcement, and a `maintenance` entry saying
  why running past it is tolerable and what replaces it — an honest position on an unmaintained
  component rather than silence.
- A `maintenance` entry that says what happens if the supplier disappears, and what replacement would
  cost.

## ❌ Bad (and why)

- `version: "^18.2.0"` — ❌ a range. Which one did you assess?
- *"Support ends at some point."* — ❌ not a date, so nothing can compare it to today.
- An end-of-life date with no source — ❌ a claim about a supplier's intentions with nothing behind it.
- *"React is a JavaScript library for building user interfaces."* — ❌ the supplier's description, not
  your requirement. It would still be true if the component were entirely unsuitable.
- Listing every transitive dependency — ❌ that is the SBOM. This register is what you assessed, and an
  entry you cannot defend is worse than an absent one.
- Recording the test runner and the bundler — ❌ development tools, §5.1.4, not SOUP.
- An end-of-life date left over from a previous major version — ❌ the dates move when the version does.

## Keeping it true

A component's assessment is invalidated by **its own version changing**, not by yours. When you
upgrade, revisit the requirements you place on it, its limitations, and its end-of-life date: support
windows are per release line, so a major-version bump usually moves the date.

A component may be named as the **cause of a risk** exactly as one of your own units can: a supplier's
defect and your own are the same kind of problem from the patient's point of view.

See also: `guides/risk.md` (a component as a cause), `guides/detailed-design.md` (the units that use
it), `guides/requirements.md` (why a requirement on a supplier does not belong there).
