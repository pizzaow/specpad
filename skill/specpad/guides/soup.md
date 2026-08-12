# Authoring guide — SOUP / off-the-shelf software

Read this before adding or revising a component. Craft guidance, not policy; the enforced rules are
`soup-identity`, `soup-requirements`, `soup-anomalies` and `soup-referential-integrity`.

## Purpose

The register records **the third-party software the product depends on, and what you know about it**:
exactly which version, what you require of it, what it needs to run, what is known to be wrong with it,
and what happens when the supplier stops.

Two regimes, one record. **IEC 62304** asks what you require of the component (§5.3.3), what it needs
to run (§5.3.4), and what its published anomalies mean for you (§7.1.2). **FDA's off-the-shelf software
guidance** asks where it came from, why it is appropriate, what its limits are, how it is tested, and —
at Enhanced level — what the end-of-life plan is. Neither is a subset of the other, so both are
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
| `anomalies` + `anomaliesReviewed` | What is known to be wrong, at this version, and when you last looked | §7.1.2/3, FDA |
| `usedBy`, `tests` | Which units use it; what exercises it | §5.3.3, FDA |
| `maintenance` | Supplier's practices, support, and the plan for when it ends | FDA (Enhanced) |

### The version is exact, and that is the point

A range is not an identity. `^18.2.0` says nothing an auditor can act on, because **an anomaly
evaluation is only valid for the version it was performed against**. Record what is actually installed.
When it changes, the evaluation is stale until someone redoes it.

### Requirements are what you require *of it*

Not what it claims to do — what your product needs it to do, phrased so a failure would be recognisable.
"Renders CommonMark to React elements; must not execute embedded HTML" is a requirement. "A markdown
renderer" is a description.

Put them here as text rather than in the SRS. The requirements register holds behaviour **this product
implements**; a requirement on a supplier is neither implemented here nor verified here.

### Anomalies are the hard field, and the one auditors read

The requirement is to evaluate the supplier's published anomaly list *for the version in use*, and to
say whether any of it matters here. That means: **look**, then write down what you concluded and why.

The useful form is a judgement, not an inventory: which known defects touch the features you use, and
why the rest cannot reach you. "No known issues" is only credible with a date beside it and a statement
of what was searched.

## ✅ Good

- *"Issue tracker reviewed for 8.20.0. Open items concern draft-2020 features, TypeScript typings and
  code generation for unusual keyword combinations. None affects draft-07 validation of the keywords
  used here."* — names what was searched, and reasons about reach rather than counting bugs.
- *"End-of-life: no further releases will be made. Accepted deliberately — a stylesheet cannot develop
  new defects, and the JavaScript components that held the security-relevant issues are not loaded."*
  — an honest position on an unmaintained component, with the reason it is tolerable.
- A `maintenance` entry that says what happens if the supplier disappears, and what replacement would
  cost.

## ❌ Bad (and why)

- `version: "^18.2.0"` — ❌ a range. Which one did you assess?
- *"No known issues."* — ❌ unfalsifiable and undated. Known to whom, searched where, when?
- *"React is a JavaScript library for building user interfaces."* — ❌ the supplier's description, not
  your requirement. It would still be true if the component were entirely unsuitable.
- Listing every transitive dependency — ❌ that is the SBOM. This register is what you assessed, and an
  entry you cannot defend is worse than an absent one.
- Recording the test runner and the bundler — ❌ development tools, §5.1.4, not SOUP.
- An anomaly evaluation dated two years and six releases ago — ❌ formally present, actually worthless.

## Keeping it true

A component's assessment is invalidated by **its own version changing**, not by yours. When you upgrade,
the anomaly evaluation is stale until redone — that is the field to revisit first, and the date is what
makes staleness visible.

A component may be named as the **cause of a risk** exactly as one of your own units can: a supplier's
defect and your own are the same kind of problem from the patient's point of view.

See also: `guides/risk.md` (a component as a cause), `guides/detailed-design.md` (the units that use
it), `guides/requirements.md` (why a requirement on a supplier does not belong there).
