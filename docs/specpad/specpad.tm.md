# SpecPad — Threat model

> The threat modelling pass: how the system was decomposed, what was walked, and what that
> found. Method follows the *Playbook for Threat Modeling Medical Devices* (MITRE and MDIC,
> commissioned by FDA, 2021 — still the current edition), which is organised around four
> questions rather than a single prescribed technique.
>
> This document is the **analysis**. Its output is the register in `specpad.threat.json`;
> the system it analyses is described in `specpad.sec.md`. Three artefacts because they
> answer different questions and go stale at different rates.

## 1. What are we working on?

SpecPad is two deployments that share a contract. Only one of them is exposed.

**Hosted editor** — a static page from a CDN, running in the author's browser against their
own filesystem. No server, no session, no stored credential.

**Self-hosted server** — one process serving the editor build and an HTTP API from a single
origin, behind a company proxy, holding a machine credential that can push to a real
repository. This is where the analysis spends its time.

### Decomposition

Elements were taken from the detailed design rather than invented, so the walk and the
design cannot drift apart. Each is a unit in `specpad.sdd.json`.

| | Element | Design |
|---|---|---|
| **External** | Author (browser), identity proxy, git remote, CDN, Claude Code + skill, host operator | — |
| **Server** | HTTP API · routing · auth · paths · git plumbing · repository · working copy · commit gate · presence and events · entry point · config | SDD-50 to SDD-61 |
| **Client** | Editor bundle · local transport · remote transport · demo transport · handle store | SDD-19 to SDD-27 |
| **Stores** | Bare clone and per-user worktrees · the remote repository · persisted directory handles · the machine credential · the config file | SDD-56, SDD-27, SDD-50 |

### Trust boundaries

Four, and every threat in the register crosses one of them:

1. **Browser → proxy.** Untrusted until the company's SSO says otherwise.
2. **Proxy → server.** The one place identity is asserted rather than proven, and the hop
   that is plain HTTP.
3. **Server → filesystem and git.** Where a request becomes a path and an argument vector.
4. **Server → git remote.** Where the machine credential is used.

## 2. What can go wrong?

STRIDE walked across each element, rather than listing attacks and labelling them
afterwards. The playbook is explicit that the technique is a means to the question, and the
value showed up in the difference: the first pass produced **9 threats** from the obvious
surfaces; walking the elements produced **24**.

### What the second pass found that the first did not

| | Why the first pass missed it |
|---|---|
| **THR-12 · argument injection into git** | SpecPad never uses a shell, so "command injection" was answered and dismissed. A path beginning with `-` is not a command injection; it is an option the caller chose, and git has options that read files. |
| **THR-13 · symlink inside the allowlist** | Path validation and sparse-checkout each looked complete. The threat lives in the gap between them: neither resolves a link the repository itself contains. |
| **THR-15 · a direct push** | Attacker-first thinking looks for attackers. The most likely integrity failure here needs no attacker — a developer with push rights bypasses the commit gate by using git normally. |
| **THR-16 · nothing is logged** | Found by walking the *control* categories rather than the threats. Every FDA category had something in it except event detection and logging, which had nothing — a question the threat list alone could not raise. |
| **THR-21 · a persisted directory handle** | Individually low. It matters because it changes the impact of THR-5 and THR-20: a page that turns hostile does not start from zero, it starts with the access already granted. |
| **THR-10, THR-11 · the proxy hop** | The first pass modelled bypassing the proxy. It did not model an attacker who does not need to, because the identity is on the wire, or one who can source packets from the trusted address. |

### Coverage

| Category | Threats |
|---|---|
| Tampering | 7 |
| Elevation of privilege | 5 |
| Denial of service | 4 |
| Information disclosure | 4 |
| Spoofing | 2 |
| Repudiation | 2 |

Repudiation being the thinnest is not a sign it was covered well. It is THR-16: there is
almost nothing to repudiate *against*, because almost nothing is recorded.

## 3. What are we going to do about it?

Of 24 threats, 13 name a controlling requirement and **11 do not**. Those eleven carry a
justification saying why, and that number is the honest output of this pass rather than an
embarrassment to be tidied away. They fall into three groups:

**Deliberately outside the software** — THR-10 (the proxy hop is a deployment property),
THR-15 (branch protection belongs on the remote), THR-22 (accepted). Documented, not built.

**Decided against, knowingly** — THR-21, where re-prompting for a directory handle every
visit was traded against usability.

**Not yet decided** — THR-13 (symlink resolution), THR-14 (no timeout on a git subprocess),
THR-16 (no security event log), THR-18 (no credential redaction), THR-20 (no build
integrity), THR-23 (no subscription bound). These are recorded `not_assessed` because the
position genuinely has not been taken, and marking them acceptable would be a claim nobody
has made.

**THR-16 is the one to act on first.** It is not merely an uncontrolled threat, it is an
empty FDA control category — and it is the category that would tell us whether any of the
others had been exercised.

## 4. Did we do a good enough job?

Honestly: better than the first pass, and not finished.

**What gives confidence.** Elements came from the detailed design, so nothing was analysed
that does not exist and nothing that exists was skipped. Every threat names its causing unit
or component, so the register can be checked against the design mechanically. Every control
is a requirement, so control verification comes from the existing trace rather than from a
second argument.

**What does not.** No adversarial review by a second person — this pass was written by
whoever wrote the system, which is the weakest position for finding what they assumed. No
attack trees or kill chains, which the playbook offers for the paths worth going deeper on;
THR-12 and THR-13 both deserve one. No penetration testing of any kind. The client-side
elements were walked less thoroughly than the server, defensibly given the exposure, but
"defensibly" is not "completely".

**When this is re-run.** The playbook treats threat modelling as continuous, not an
artefact. Re-walk the affected elements when: a new interface or trust boundary appears, a
component lands on the perimeter, an authentication or authorization path changes, or a
control listed above is finally built — because building one changes the residual on
several.
