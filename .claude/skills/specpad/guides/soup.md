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
the version it was performed against**, and a range does not name one. Record what is actually
installed, and revisit the record when it changes.

### Requirements are what you require *of it*

Not what it claims to do — what your product needs it to do, phrased so a failure would be recognisable.
"Renders CommonMark to React elements; must not execute embedded HTML" is a requirement. "A markdown
renderer" is a description.

Put them here as text rather than in the SRS. The requirements register holds behaviour **this product
implements**; a requirement on a supplier is neither implemented here nor verified here.

### Known defects are not recorded here

Evaluating a supplier's published anomalies is a per-version exercise against a moving list, and it
belongs with the bill of materials and its vulnerability feed rather than with the assessment of the
component. Keeping a hand-written anomaly paragraph beside a machine-generated advisory feed produces
two answers to one question, and the stale one is the one that gets read.

### End of life is a date, not a sentence

`endOfLife` is the date the supplier's support ends, and `endOfLifeSource` is where you got it. A date
can be compared to today; a paragraph saying support "will end eventually" cannot, and a component that
went out of support two years ago will sit in the register unnoticed.

If no end of life has been announced, leave it empty — that is a different statement from a date in the
past, and the register shows them differently. Put the *plan* in `maintenance`: what you will do when
the date arrives, or why you are content to run past it.

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
