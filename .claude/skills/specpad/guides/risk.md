# Authoring guide — Software risk (IEC 62304 §7)

Read this before writing or revising risk entries. Craft guidance, not policy; the enforced rules are
`risk-referential-integrity`, `risk-cause` and `risk-controlled`.

## Purpose

The risk register records **what the software can contribute to going wrong, and what stops it**. Each
entry is a hazardous situation, the software items that could cause it, and the requirements that
control it.

## What this register is not

**It is not the risk management file.** ISO 14971 asks for hazards, foreseeable sequences of events,
harms, probability estimation, risk evaluation, benefit-risk analysis and post-production monitoring.
Most of that is clinical rather than software, changes on a different cycle, and belongs to the quality
system. SpecPad holds the **IEC 62304 §7 slice** and points at the rest through `hazardRef`.

If your project has no separate risk management file, `hazardRef` is simply empty — the software
analysis still stands on its own.

**It is not the threat model.** Security risk is a separate process (IEC 62304 Ed 2, AAMI SW96,
IEC 81001-5-1) with a different question: not "what could fail" but "who would attack this, and how".
Mixing them produces a register that answers neither well. That pillar gets its own register.

## What to capture

One entry per hazardous situation software can contribute to:

| Field | |
|---|---|
| `text` | The hazardous situation, in terms of what the software does or fails to do |
| `sequence` | The events between the software failure and the hazardous situation (§7.1.5) |
| `hazardRef` | The hazard or hazardous situation in the system risk file, if there is one |
| `severity` | Severity of the resulting harm |
| `causes` | The **software units** that could cause it (§7.1) |
| `controls` | The **requirements** implementing the control measures (§7.2, §5.2.2) |
| `justification` | Why no software control is needed, when there is none |
| `residual` | The judgement once the controls are in place |

## The sequence of events is the analysis

`text` records the hazardous situation. `sequence` records **how the software gets there** — and §7.1.5
asks for it because the steps are where the controls go.

> ❌ *"An overdose is delivered."*
> ✅ *"The rate is mis-parsed as 200 rather than 20, no range check rejects it, the pump accepts the
> value, and infusion proceeds at ten times the intended rate."*

The second version has four steps, and **each one is a place a control could break the chain**. The
first has none, which is why a register full of endpoints tends to produce a single vague control per
risk. Write the sequence and the controls suggest themselves.

Two habits worth keeping:

- **Include the human step where there is one.** "The clinician reads it as measured" is part of the
  sequence, and it is usually the step that decides severity.
- **§7.3.2 asks the same question of your controls.** A control that introduces a new sequence — a
  watchdog that reboots mid-infusion, say — needs its own entry. Adding a control is a reason to
  re-read this register, not just to fill a column.

## There is no probability, and that is deliberate

For software you cannot argue probability down. A defect is either present or absent; it does not fail
one time in ten thousand because it is unlucky. So the analysis is driven by **severity** and by
whether a control exists — not by an estimate nobody can defend.

This is the single most common mistake in a software risk table: a row where the risk was made
acceptable by rating the probability "remote". If you find yourself reaching for that, what you
actually have is either a control you have not written down, or an unacceptable risk.

## A control is a requirement

§5.2.2 is explicit: a risk control measure implemented in software **is** a software requirement. So
`controls` points at SRS ids rather than restating the control as prose.

Two things follow, and both are the point:

- The control has to be **testable**, because it is a requirement and every requirement needs a
  verifying test.
- **Verification of the control (§7.3) is then automatic** — the tests already verifying that
  requirement, and the captured run, are the evidence. Nothing needs to be recorded twice.

If a control cannot be phrased as a requirement, it is not a software control. Say so in
`justification` and record where it actually lives.

## Causes are units, not views

`causes` names the **software units** that could produce the situation — sections of the detailed
design with `kind: "unit"`. A design view describes structure across units and cannot fail on its own,
so naming one is rejected.

Be specific. "The application" is not a cause; `merge` and `workingCopy` are.

## ✅ Good

- *"Two people edit one document and the reconciliation silently drops an item, duplicates an id, or
  leaves a reference pointing at something that no longer exists."* — a situation, observable, and you
  can point at the units that would cause it.
- A control list of five requirements that between them make the situation impossible, each already
  carrying tests.
- A risk with **no** software control and a `justification` naming where it is controlled instead.
  Honest, and far better than inventing a requirement to fill the column.

## ❌ Bad (and why)

- *"Software bug."* — ❌ not a hazardous situation. What happens to whom?
- *"Risk of data loss — probability: remote, therefore acceptable."* — ❌ the probability argument this
  register exists to refuse. Name the control, or accept that the risk is not controlled.
- A control written as prose in `notes` with nothing in `controls` — ❌ the control is invisible to the
  trace and cannot be verified. Write it as a requirement.
- *"Cause: the editor."* — ❌ too coarse to act on and too coarse to verify.
- A risk added because the register looked thin — ❌ a risk analysis is not a coverage exercise. An
  entry nobody believes in dilutes the ones that matter.
- Copying every row of the system risk file in — ❌ only the situations software contributes to belong
  here; the rest are already recorded where they belong.

## Keeping it true

A risk is re-examined when the units causing it change, when a control changes, or when a control's
test starts failing — the last of which the run makes visible without anyone rechecking anything.

Deleting a control requirement without revisiting the risks pointing at it is the failure mode to watch
for; governance reports the dangling reference, but only a person can decide whether the risk is now
uncontrolled.

See also: `guides/requirements.md` (controls are requirements), `guides/detailed-design.md` (causes are
units), `guides/tests.md` (how a control is verified).
