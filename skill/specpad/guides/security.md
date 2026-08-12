# Authoring guide — Threat model and security architecture

Read this before adding or revising a threat, or writing a security architecture view. Craft guidance,
not policy; the enforced rules are `threat-referential-integrity`, `threat-assessed` and
`threat-controlled`.

## Purpose

The threat model records **what an attacker would try, what it would get them, and what stops them**.
The security architecture document describes **the system those threats act against**.

They are one activity split across two documents because they answer different questions: the register
is per-threat and governed; the architecture is per-view and read whole.

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

Four, and a submission is expected to contain all four (FDA). Write them for a reader who does not know
the system:

1. **Global system view** — the system and every connection in or out, and where trust begins.
2. **Multi-patient harm view** — how an attack on one instance reaches beyond it. If the product has no
   fleet and no patient-facing function, **say so and state the indirect path**: an auditor reads the
   view's absence as an omission and its dismissal as an argument.
3. **Updateability and patchability view** — how a fix reaches a deployed instance, who acts, and what
   an operator who does nothing stays on.
4. **Security use cases** — the flows where an attacker's interest meets the system's function, each
   naming the threats that act on it.

Where this and the architecture document describe the same structure, **the architecture document is
the source** and this is the security reading of it. Two descriptions of one system will drift, and the
drift will be found by a reviewer rather than by you.

## Keeping it true

A threat is re-examined when the attack surface changes: a new interface, a new trust boundary, a new
component on the perimeter. Adding an entry point without walking STRIDE across it is how a threat
model goes stale while looking complete.

See also: `guides/risk.md` (the safety risk a threat creates), `guides/soup.md` (a component as attack
surface), `guides/architecture.md` (the structure these views read).
