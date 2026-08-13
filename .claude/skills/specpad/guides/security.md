# Authoring guide — Threat model and security architecture

Read this before adding or revising a threat, or writing a security architecture view. Craft guidance,
not policy; the enforced rules are `threat-referential-integrity`, `threat-assessed` and
`threat-controlled`.

## Purpose

The threat model records **what an attacker would try, what it would get them, and what stops them**.
The security architecture document describes **the system those threats act against**.

They are one activity split across two documents because they answer different questions: the register
is per-threat and governed; the architecture is per-view and read whole.

## The method: the playbook's four questions

Threat modelling here follows the *Playbook for Threat Modeling Medical Devices* (MITRE and
MDIC, commissioned by FDA, 2021 — still the current edition). It is deliberately not
prescriptive about technique; it is organised around four questions, and the discipline is
answering all four rather than only the second.

1. **What are we working on?** Decompose the system — elements, trust boundaries, data flows.
   **Take the elements from the detailed design**, not from memory: then nothing is analysed
   that does not exist, and nothing that exists is skipped.
2. **What can go wrong?** Walk STRIDE across **each element**, rather than listing attacks and
   labelling them afterwards. The order matters more than it sounds — see below.
3. **What are we going to do about it?** A control (a requirement), an accepted risk with a
   reason, or a transfer to the deployment or the operator. All three are legitimate answers;
   silence is not.
4. **Did we do a good enough job?** Say what gives confidence and what does not. An analysis
   with no stated weakness has not been reviewed, it has been asserted.

Record the pass as its own document (`<name>.tm.md`) — the analysis is not the register and
not the architecture views. Three artefacts because they answer different questions and go
stale at different rates: the register when a threat changes, the views when the system does,
the pass when either does enough to need re-walking.

### Walk elements, not attacks

Listing attacks finds the attacks you already know. Walking elements finds the ones you do
not, and the difference is not marginal. Threats that show up only this way:

- **Between two controls.** Each looks complete alone; the threat lives in the seam. Path
  validation and a restricted checkout can both be correct and still not resolve a symlink.
- **Without an attacker.** The likeliest integrity failure is often an authorised person
  taking a normal route that bypasses the gate. Attacker-first thinking looks for attackers.
- **From a category that is empty.** An entry point with no threat in a STRIDE category is a
  question. So is a *control* category with nothing in it — walking the FDA control
  categories is how "we log nothing at all" gets found, because a threat list cannot raise it.
- **Individually minor, jointly not.** A stored credential or handle is dull on its own and
  changes the impact of every code-execution threat in the model.

### Say what the pass did not do

Question four is the one people skip. Name the missing: no adversarial review by a second
person, no attack trees on the paths that deserve them, no penetration testing, an area
walked less thoroughly than another. A reader can weigh an analysis whose limits are stated;
one that claims none reads as unreviewed.

## One register, not two

A threat model and a security risk analysis are the same register here. Identifying a threat and
assessing it are one act — you cannot say what an attacker would try without saying how hard it would
be and what it would cost you — and splitting them produces two documents that must be kept in step.

This follows AAMI SW96 and TIR57, which treat security risk management as its own process alongside
safety risk rather than a section of it.

## Exploitability, not probability

A safety risk drops probability because software fails deterministically. A security risk drops it for
the opposite reason: **an attacker chooses when to act**. There is no frequency to estimate, and a
defence is worth what it costs to defeat rather than how often it is tested.

So `exploitability` records how readily the threat can be realised — the access required, the skill,
and the opportunity:

| | |
|---|---|
| **high** | Reachable by an unauthenticated party with common tools |
| **medium** | Needs a foothold, specific knowledge of this system, or an unusual position |
| **low** | Needs a capability most attackers do not have, or a precondition outside the attacker's control |

Judge it from the attacker's side, not from how well you think you have defended it — the controls are
recorded separately, and rating exploitability low *because* of the controls double-counts them.

## What to capture

| Field | Answers |
|---|---|
| `text` | What an attacker does, and what it gets them |
| `asset` | What is at stake — the data, function or property being attacked |
| `entryPoint` | Where the attack enters: the interface or trust boundary it crosses |
| `category` | STRIDE |
| `exploitability`, `impact` | How readily, and how badly |
| `causes` | The units or components presenting the surface |
| `controls` | The requirements implementing the defences |
| `safetyRisk` | The safety risk exploiting it would create |
| `residual` | The judgement once controls are in place |

### STRIDE earns its place through coverage

Spoofing, tampering, repudiation, information disclosure, denial of service, elevation of privilege.
Its value is not the label on a threat you already found: it is the prompt. Take each entry point and
ask all six. **An entry point with no threat in a category is a question**, and the answer is often
"because nothing there is worth that" — which is worth recording once rather than rediscovering.

### Controls are grouped by the FDA categories

`controls` names the requirements; `securityControl` on each of those requirements says
**which FDA category it is** (*Cybersecurity in Medical Devices*, February 2026, §V.B.1):
authentication, authorization, cryptography, code/data/execution integrity, confidentiality,
event detection and logging, resiliency and recovery, updatability and patchability.

This is the coverage argument. "We have security requirements" is not one; "here is what we
have in each of the eight categories" is. Walk all eight — **an empty category is a question**,
and the honest answers differ: a product that implements no cryptography of its own has a
real reason, while a product that logs nothing has found a gap. Both are worth knowing, and
only the sweep distinguishes them.

FDA asks for requirements **and acceptance criteria** per category, so a control with no
verifying test is an incomplete answer even when the requirement is well written.

### A control is a requirement

The same rule the safety risk register follows, for the same reason: a control implemented in software
is a software requirement, so `controls` points at SRS ids rather than restating the defence. The
control must then be testable, and its verification comes free from the trace.

Where a threat has no software control, say why in `justification`. A threat accepted, or controlled by
the deployment environment, is a legitimate entry. A control invented to fill the column is not.

### `safetyRisk` is the join that matters

Where exploiting a threat could harm someone, name the safety risk it creates. That link is the whole
point of security risk management sitting beside safety risk rather than inside it: **a security
finding with a patient consequence belongs in both files**, assessed on exploitability in one and on
severity in the other.

A threat with no safety consequence — an availability problem on a documentation tool, say — simply has
none, and leaving it empty is a statement rather than an omission.

## ✅ Good

- *"An attacker reaches the server directly and asserts an identity header, publishing specification
  changes as somebody else."* — an action, an entry point, and a consequence.
- A threat whose `justification` says the control is absent and the position undecided, recorded as
  `not_assessed` rather than quietly accepted.
- *"Exploitability medium rather than low because the path is the obvious thing to tamper with once
  multi-project hosting is known."* — reasons about the attacker, not about the defence.

## ❌ Bad (and why)

- *"SQL injection."* — ❌ a technique, not a threat. Against what, entering where, achieving what?
- *"Mitigated by input validation."* — ❌ prose where a requirement should be. If the control is real it
  is a requirement and can be tested; if it is not, the threat is uncontrolled.
- Exploitability rated low *because* the control exists — ❌ double-counts the control, and the rating
  becomes meaningless once the control is questioned.
- A threat model that is the OWASP Top Ten with the product's name substituted — ❌ generic threats
  produce generic controls; the useful entries come from this system's own entry points.
- Every threat marked acceptable — ❌ an analysis that never found anything is an analysis nobody did.

## The architecture views

FDA names four *types* of view (*Cybersecurity in Medical Devices: Quality Management System
Considerations and Content of Premarket Submissions*, 3 February 2026, §V.B.2 and Appendix 2). Write
them for a reader who does not know the system:

1. **Global system view** — the system and every connection in or out, and where trust begins.
2. **Multi-patient harm view** — how an attack on one instance reaches beyond it. If the product has no
   fleet and no patient-facing function, **say so and state the indirect path**: an auditor reads the
   view's absence as an omission and its dismissal as an argument.
3. **Updateability and patchability view** — how a fix reaches a deployed instance end to end, who
   acts, and what an operator who does nothing stays on.
4. **Security use cases** — the flows where an attacker's interest meets the system's function, each
   naming the threats that act on it.

Every view states what it covers, and the four should collectively answer: what the security-relevant
elements and their interfaces are, where the boundaries and domains sit, **which user roles exist**,
and how the architecture traces to the security requirements.

### Four types, more than four views

The count is a floor, not a target. The guidance is explicit that the number of views scales with the
attack surface, and that a single global view need not carry every data flow — additional views may
detail the communications instead.

So: **one system-level overview, then a view per system or deployment.** A product with a device, a
companion app and a cloud service has at least four global views, not one crowded one. Two deployments
with different exposure — a hosted page and a self-hosted server, say — are two views, because drawing
them as one misrepresents both.

A view that is not appropriate is **omitted with a reason given**, never dropped silently.

### Every view has a diagram

The guidance asks for "both diagrams and explanatory text". Prose alone is an incomplete view, and so
is a diagram nobody can follow. A reviewer should be able to trace data, code and commands from any
asset to any other without asking a question.

The multi-patient harm view is the one people leave as prose, usually because the answer is "not
applicable". Draw it anyway: the harm path, however long and indirect, and — more useful — **the gates
that interrupt it**. A drawn path with three gates on it is an argument; a paragraph saying the product
treats nobody is an assertion.

### Label every connector

An unlabelled arrow says two things are connected and nothing else. Each connector carries what
traverses it and over what: `identity headers (data) · HTTP 8080`, `commit + push (control) · HTTPS
443`. Distinguish **data, code and commands** — the guidance asks for it specifically, and the
distinction is what tells a reviewer whether a path can change behaviour or only content.

Give each figure a **legend**: what the shape colours mean, and what solid, dashed and dotted lines
mean. Mark third-party components with their `SOUP-n` code, which is also the SBOM link the guidance
asks for.

### The communication-path table

A diagram cannot hold the detail Appendix 2 asks for — roughly nineteen items per path — so put it in a
table beside the figure, one row per path between two assets, including indirect paths through an
intermediary. Columns worth having: what it carries (data / code / commands), protocol, version and
port, what authenticates it, what authorizes it, the threats on it, and the controls.

Then cover in prose, once per view rather than once per row:

- **Unused interfaces** — ports and functionality built but not enabled, and why they cannot be
  activated. "There are none, and here is why" is a strong answer.
- **Handoffs** — where a path changes protocol, network or medium, and what protects integrity across
  the change. This is usually the weakest point in the system and the one reviewers go to first.
- **Cryptography and credentials** — algorithms, key lengths, and how each credential is generated,
  stored, distributed and retired. If you implement none of your own, say that plainly and name what
  provides it.
- **Sessions** — how they are established, maintained and torn down; or that there are none.
- **Behaviour when things go wrong** — a connection dropped mid-transfer, a push that loses its race.
- **Security configuration settings and their defaults.**

### Traceability, without restating it

The guidance wants diagram elements linked to hazards, controls and testing. Do not rebuild that chain
in prose — it already exists and a copy will drift. State where it lives: each element is a design unit
or a SOUP component, each threat names its `causes` and `controls`, and each control is a requirement
that a test verifies. Following those fields *is* the trace.

Where this and the architecture document describe the same structure, **the architecture document is
the source** and this is the security reading of it. Two descriptions of one system will drift, and the
drift will be found by a reviewer rather than by you.

### ❌ Bad views (and why)

- A global system view with one box labelled "Cloud" — ❌ hides exactly the connections the view exists
  to show.
- Arrows labelled "HTTPS" and nothing else — ❌ says how, never what. Two paths over the same protocol
  can carry a document and a firmware image.
- A multi-patient harm view reading "N/A — not a networked device" — ❌ a conclusion with no analysis
  behind it. State the path you considered and where it stops.
- An updateability view that stops at "the operator updates the device" — ❌ end-to-end means from where
  the patch is built to where it runs, including the hops you do not control.
- One global view carrying forty flows — ❌ decompose it. If the connectors cross more than about three
  times, the diagram has outgrown its scope.

## Keeping it true

A threat is re-examined when the attack surface changes: a new interface, a new trust boundary, a new
component on the perimeter. Adding an entry point without walking STRIDE across it is how a threat
model goes stale while looking complete.

See also: `guides/risk.md` (the safety risk a threat creates), `guides/soup.md` (a component as attack
surface), `guides/architecture.md` (the structure these views read).
