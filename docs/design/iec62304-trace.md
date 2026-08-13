# SpecPad against IEC 62304 — a clause-by-clause trace

**Edition traced:** IEC 62304:2006+A1:2015 (Ed 1.1), which remains the edition in force. Edition 2 is
still in ballot — comment resolution and voting began August 2026, with publication expected around
May 2027 and a two-to-three-year regulatory transition after that. Ed 2 collapses the three safety
classes into two rigor levels, widens scope from medical device software to health software, and adds
an AI/ML lifecycle. None of that changes this trace today, but it does affect where effort is worth
spending — see the note on classification under 4.3.

**What is being traced.** Two questions at once, kept apart on purpose:

- *Tool*: if a manufacturer used SpecPad as intended, would the records it produces satisfy the clause?
- *Dogfood*: does SpecPad's own documentation satisfy it?

Where they differ, the tool answer governs — a gap in SpecPad's own files is a content problem, a gap
in what SpecPad can hold is a product problem.

**Verdicts.** *Held* — the clause has a home and governance keeps it honest. *Partial* — the record
exists but cannot be checked, or is missing a required element. *Absent* — nowhere to put it.
*By decision* — deliberately excluded, with the reasoning recorded.

---

## Clause 4 — General requirements

| Clause | Requires | Where it lives | Verdict |
|---|---|---|---|
| 4.1 | Quality management system | Nowhere — SpecPad is not a QMS. It produces records a QMS consumes. | Out of scope |
| 4.2 | Risk management per ISO 14971 | `specpad.risk.json` is the software half; the system risk file is external, joined by `hazardRef` | Partial |
| 4.3 | Software safety classification A/B/C, documented with rationale | Nothing. `SKILL.md` states the position: author at maximum rigor, always, so no class appears in the schema | By decision — but see below |
| 4.4 | Legacy software: gap analysis and a risk-based justification | The baseline generator drafts a spec from existing code, which is the mechanism; nothing records the 4.4 justification | Absent |

**4.3 deserves scrutiny.** "Always document at Class C rigor" is a defensible engineering choice and it
is written down. It is not, however, what 4.3 asks for: the clause wants the classification *and its
rationale* as a record, and a submission that never states a class has not satisfied it — it has
over-delivered on content while omitting the declaration. The cheap fix is not to build class-based
filtering; it is to let a project *declare* its class and state why, and keep authoring at full rigor
regardless. That also lands squarely on Ed 2's two-level scheme when it arrives.

## Clause 5.1 — Software development planning

| Clause | Requires | Verdict |
|---|---|---|
| 5.1.1–5.1.3 | A software development plan, kept current, referencing system design | Absent |
| 5.1.4 | Standards, methods and tools (Class C) | Absent |
| 5.1.5 | Integration and integration-testing planning | Absent |
| 5.1.6 | Verification planning | Absent |
| 5.1.7 | Risk management planning | Absent |
| 5.1.8 | Documentation planning | Absent |
| 5.1.9–5.1.11 | Configuration management planning; items under control before verification | Partial — git covers the mechanism, nothing states the plan |
| 5.1.12 | Identification and avoidance of common software defects (Class B, C) | Absent |

This is the largest structural gap in the trace, and it is structural rather than incidental:
**SpecPad models outputs, not plans.** Every register answers "what is true of this product"; none
answers "how this project will be run". A manufacturer using SpecPad today still writes their SDP in a
word processor, and the plan then drifts from the registers that are supposed to implement it.

## Clause 5.2 — Software requirements analysis

| Clause | Requires | Where it lives | Verdict |
|---|---|---|---|
| 5.2.1 | Requirements derived from system requirements | SRS; `satisfies` gives the upward trace to the PRD | Held |
| 5.2.2 | Content across nine categories — functional, inputs/outputs, interfaces, alarms, security, usability, data definition, installation and acceptance, maintenance, regulatory | Free text plus optional `tags`; the requirements guide does not prompt the categories | Partial |
| 5.2.3 | Risk control measures included as requirements | `risk.controls` → SRS ids, enforced by `risk-controlled` | **Held — a strength** |
| 5.2.4 | Re-evaluate the risk analysis when requirements change | Change tracking shows the SRS changed; nothing prompts or records the re-evaluation | Partial |
| 5.2.5 | Update system requirements | The PRD is the upward trace | Partial |
| 5.2.6 | Verify requirements | `traceability` and `missing-expected` | Held |

On 5.2.2: a reviewer asked "show me your security requirements" can answer from SpecPad only by reading
every requirement. The categories are a coverage prompt in the same way STRIDE is for threats — the
value is not the label but the question "is there really nothing here?".

## Clause 5.3 — Software architectural design

| Clause | Requires | Where it lives | Verdict |
|---|---|---|---|
| 5.3.1 | Architecture transformed from requirements | `specpad.sad.md` (arc42 + C4) | Held |
| 5.3.2 | Architecture for interfaces | SDD-5, the external interfaces view | Held |
| 5.3.3 | Functional and performance requirements *of* each SOUP item | `soup.requirements`, enforced by `soup-requirements` | **Held — a strength** |
| 5.3.4 | Hardware and software the SOUP item needs | `soup.runtime` | Held |
| 5.3.5 | Segregation necessary for risk control (Class C), and why it is effective | Nothing | Absent |
| 5.3.6 | Verify the architecture implements requirements and supports SOUP | No rule; the SAD is prose nobody checks against 5.3.6's three criteria | Partial |

## Clause 5.4 — Software detailed design

| Clause | Requires | Where it lives | Verdict |
|---|---|---|---|
| 5.4.1 | Refine the architecture into software units | `SddSection.kind = 'unit'` — this closed JOB-51 gap 1 | Held |
| 5.4.2 | Detailed design per unit | SDD `body` | Held |
| 5.4.3 | Interface design, including invalid parameters | Prompted by `guides/detailed-design.md` | Held |
| 5.4.4 | Verify the detailed design | `sdd-coverage` ties requirements to design; no record that the design itself was verified | Partial |

## Clause 5.5 — Unit implementation and verification

| Clause | Requires | Where it lives | Verdict |
|---|---|---|---|
| 5.5.1 | Implement each unit | Code, with `source` paths on the SDD section | Held |
| 5.5.2 | A unit verification process | The VTP and the captured run | Partial |
| 5.5.3 | Acceptance criteria per unit | Prose only, where the guide says it is not self-evident | Partial |
| 5.5.4 | Additional criteria (Class C): event sequencing, resource use, fault handling, boundary values | Nothing structured | Absent |
| 5.5.5 | Verify units and record the result | VTP results derived from a captured run | Held |

5.5.3 is the recurring shape of these gaps: **the guide asks for it, so good projects have it, but
nothing can find it.** Acceptance criteria live inside markdown prose, so they cannot be rolled up per
unit, cannot be governed, and cannot be shown to a reviewer as a list.

## Clauses 5.6 and 5.7 — Integration and system testing

| Clause | Requires | Verdict |
|---|---|---|
| 5.6.1–5.6.5 | Integrate units, verify integration, test per plan, evaluate procedures | Partial |
| 5.6.6 / 5.7.3 | Regression tests; retest after change | Partial — the suite reruns, but no record says "this was the regression decision" |
| 5.6.7 / 5.7.5 | Record contents: result, anomalies, version tested, tester identity, equipment | Partial — the run is captured; tester identity and environment are not |
| 5.6.8 / 5.7.2 | Use the problem resolution process | Absent — there is no clause 9 process |
| 5.7.1 | Tests for every software requirement | `traceability` | **Held — a strength** |
| 5.7.4 | Evaluate system testing | Partial |

**The structural gap: the VTP has no test level.** 62304 treats unit verification (5.5), integration
testing (5.6) and system testing (5.7) as three distinct activities with distinct records. SpecPad has
one flat register, so a manufacturer cannot demonstrate that each was performed — only that
requirements are covered by *something*. Adding a `level` field would be a small schema change with a
large compliance return.

## Clause 5.8 — Software release

| Clause | Requires | Where it lives | Verdict |
|---|---|---|---|
| 5.8.1 | Verification complete | Governance clean + captured run | Held |
| 5.8.2 | Document known residual anomalies | Nowhere | **Absent** |
| 5.8.3 | Evaluate residual anomalies against risk | Nowhere | **Absent** |
| 5.8.4 | Document released versions | `specpad.releases.json` | Held |
| 5.8.5 | Document how the software was created | Nothing — no build record or toolchain capture | Absent |
| 5.8.6 | All activities and tasks complete | Governance + closed jobs | Partial |
| 5.8.7 | Archive the software and documentation | Git tags; no stated retention period | Partial |
| 5.8.8 | Assure repeatability of the release | No reproducible-build record | Absent |

**5.8.2 has been conflated with the SOUP decision and should not be.** Anomalies were deliberately
removed from the SOUP register because evaluating a supplier's published defect list against a moving
feed belongs with the SBOM. That reasoning is sound and it is about *SOUP* anomalies (7.1.3). It says
nothing about **the product's own known residual defects at release**, which 5.8.2 requires and which
have no home anywhere in SpecPad. A release that ships with known bugs — every release — currently has
nowhere to say so.

## Clause 6 — Maintenance

| Clause | Requires | Verdict |
|---|---|---|
| 6.1 | A maintenance plan | Absent |
| 6.2.1 | Receive and evaluate feedback | Absent |
| 6.2.2 | Use the problem resolution process | Absent |
| 6.2.3–6.2.4 | Analyse change requests; approve them | Partial — jobs are change requests with an owner and a status, but carry no impact analysis and no approval |
| 6.2.5 | Communicate to users and regulators | Absent — and this is JOB-51 gap 4 seen from the safety side rather than the security side |
| 6.3 | Implement modifications using the development process | The working loop | Held |

## Clause 7 — Software risk management

| Clause | Requires | Where it lives | Verdict |
|---|---|---|---|
| 7.1.1 | Identify items that could contribute to a hazardous situation | `risk.causes` → SDD units and SOUP components | Held |
| 7.1.2 / 7.1.4 | Identify and document potential causes | `causes` plus the hazard text | Held |
| 7.1.3 | Evaluate published SOUP anomaly lists | Deferred to the SBOM process, deliberately | By decision |
| 7.1.5 | Document the sequence of events leading to the hazardous situation | No field; `text` holds the situation, not the sequence | Partial |
| 7.2.1 / 7.2.2 | Define risk control measures; implement in software | `controls` → SRS, because a control is a requirement | **Held — a strength** |
| 7.3.1 | Verify each control measure | Free from the SRS → VTP trace | **Held — the best answer in the file** |
| 7.3.2 | Document new sequences of events introduced by controls | Same absence as 7.1.5 | Partial |
| 7.3.3 | Document traceability hazard → cause → control → verification | The whole point of the trace graph | **Held — a strength** |
| 7.4.1–7.4.3 | Analyse changes for their effect on existing risk controls | Change tracking shows what changed; nothing analyses the effect on controls | Partial |

Clause 7 is where SpecPad is strongest, and 7.3.1 is the reason: because a control is recorded as a
requirement rather than as prose, its verification is not a separate obligation to remember — it falls
out of the rule that every requirement needs a test. That is the design decision most worth protecting.

## Clause 8 — Configuration management

| Clause | Requires | Where it lives | Verdict |
|---|---|---|---|
| 8.1.1 | Identify configuration items | Git | Held |
| 8.1.2 | Identify SOUP: title, manufacturer, unique designator | `soup-identity` | Held |
| 8.1.3 | Identify system configuration documentation | Partial | Partial |
| 8.2.1 | Approve change requests | Jobs carry an owner and a status, not an approval | Partial |
| 8.2.2 / 8.2.3 | Implement and verify changes | The commit gate | Held |
| 8.2.4 | Traceability of each change to its change request, problem report and approval | Commit → `Job:` trailer is held; problem report is absent because clause 9 is | Partial |
| 8.3 | Configuration status accounting | Releases + git history | Held |

## Clause 9 — Software problem resolution

| Clause | Requires | Verdict |
|---|---|---|
| 9.1 | Prepare problem reports; classify by type, scope, criticality | Absent |
| 9.2 | Investigate, and record the cause or why none was found | Absent |
| 9.3 | Advise relevant parties | Absent |
| 9.4 | Use the change control process | Partial — jobs exist |
| 9.5 | Maintain records | Absent |
| 9.6 | Analyse problems for trends | Absent |
| 9.7 | Verify the resolution | Partial — governance and tests |
| 9.8 | Test documentation contents | Partial |

**Clause 9 is absent in full, and its absence propagates.** Four other clauses — 5.6.8, 5.7.2, 6.2.2
and 8.2.4 — discharge their obligation by saying "use the problem resolution process". With no such
process, those four cannot be closed either. `JobType: 'bugfix'` is the nearest thing SpecPad has, and
it carries no report, no classification, no investigation record and no advisory.

---

## Summary

| Clause group | Held | Partial | Absent | By decision |
|---|---|---|---|---|
| 4 General | 0 | 1 | 1 | 1 |
| 5.1 Planning | 0 | 1 | 7 | 0 |
| 5.2 Requirements | 3 | 3 | 0 | 0 |
| 5.3 Architecture | 4 | 1 | 1 | 0 |
| 5.4 Detailed design | 3 | 1 | 0 | 0 |
| 5.5 Unit verification | 2 | 2 | 1 | 0 |
| 5.6–5.7 Integration and system test | 1 | 5 | 1 | 0 |
| 5.8 Release | 2 | 2 | 4 | 0 |
| 6 Maintenance | 1 | 1 | 4 | 0 |
| 7 Risk | 6 | 3 | 0 | 1 |
| 8 Configuration | 4 | 3 | 0 | 0 |
| 9 Problem resolution | 0 | 3 | 5 | 0 |

**The shape of it.** SpecPad is strong exactly where it was designed to be — the trace graph, clause 7,
and the parts of clause 5 that describe the product. It is weak in three bands, and they are different
kinds of weak:

1. **Process clauses with no artefact at all** — 5.1 planning, clause 6 maintenance, clause 9 problem
   resolution. These are not schema gaps; they are whole documents SpecPad does not model. Clause 9 is
   the highest-value of the three because four other clauses depend on it.
2. **Records that exist but cannot be found** — 5.2.2 categories, 5.5.3 acceptance criteria, 5.6/5.7
   test levels. The guides ask for these and careful authors provide them, but they live in prose, so
   they cannot be governed, rolled up, or shown. These are cheap schema changes with a high return.
3. **Declarations SpecPad chose not to make** — 4.3 classification, 5.8.2 residual anomalies. Both were
   reasoned decisions; on re-examination 5.8.2 looks like a conflation rather than a decision, and 4.3
   confuses "we always author at maximum rigor" with "we do not need to state a class".

Findings are recorded as gaps 5–16 against JOB-51.
