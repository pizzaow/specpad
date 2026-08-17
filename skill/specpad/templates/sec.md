# PROJECT_NAME — Security Architecture

> The architecture views a premarket submission is expected to contain (FDA, *Cybersecurity in Medical
> Devices: Quality Management System Considerations and Content of Premarket Submissions*, 3 February
> 2026), with the security development lifecycle of IEC 81001-5-1 behind them. The threat model itself
> is `PROJECT_NAME.threat.json`; this document describes the system those threats act against. Where
> this and the architecture document describe the same structure, the architecture document is the
> source and this is the security reading of it.

<!--
  Four view TYPES, and as many views as the attack surface needs. Add a numbered view per system or
  deployment after the overview; delete a view only with a stated reason.

  Every view needs a diagram AND explanatory text. Place figures with ![caption](name.svg); author
  them in draw.io and drop in the SVG export. Label every connector with what traverses it and over
  what protocol, distinguish data from code from commands, and give each figure a legend.
-->

## Critical user roles

Each role, what grants it, and what it can do. Say what scope it is resolved at — per install, or per
project.

## 1. Global system view — overview

The system and every connection into and out of it: what is inside the perimeter, what is outside, and
which boundary each connection crosses. State where trust begins — what is authenticated, by what, and
what is believed without proof.

![Global system view](PROJECT_NAME.sec.global.svg)

### 1.1 Communication paths

One row per path between two assets, including indirect paths through an intermediary.

| # | Path | Carries | Protocol · port | Authenticated by | Authorized by | Threats | Controls |
|---|---|---|---|---|---|---|---|
| P1 |  | data / code / commands |  |  |  |  |  |

Then, in prose: **unused interfaces** and why they cannot be activated; **handoffs** where a path
changes protocol or medium, and what protects integrity across the change; **cryptography and
credentials** — algorithms, key lengths, and how each credential is generated, stored, distributed and
retired; **sessions**, or that there are none; **behaviour on unexpected termination**; and **security
configuration settings with their defaults**.

## 2. Global system view — SYSTEM_OR_DEPLOYMENT_NAME

One level down, per system or per deployment. A single global view rarely carries every data flow, and
the guidance expects additional views rather than one crowded diagram. Repeat this section as needed.

![SYSTEM_OR_DEPLOYMENT_NAME](PROJECT_NAME.sec.SYSTEM.svg)

## 3. Multi-patient harm view

How an attack on one instance could reach beyond it. If the product has no fleet and no patient-facing
function, say so plainly and state the indirect harm path rather than dismissing the view — an auditor
reads its absence as an omission and its dismissal as an argument.

Draw it either way: the harm path, and the gates that interrupt it. Cover simultaneous compromise —
many instances failing at once — and the blast radius across tenants or projects if the deployment is
shared.

![Multi-patient harm](PROJECT_NAME.sec.mph.svg)

## 4. Updateability and patchability view

How a fix reaches a deployed instance, end to end: who builds it, who installs it, how long that takes,
and what an operator who does nothing stays on. Include the hops you do not control. Name the state on
disk and what an update does to it.

![Updateability and patchability](PROJECT_NAME.sec.update.svg)

## 5. Security use cases

The flows where an attacker's interest and the system's function meet — signing in, reading, writing,
publishing, rendering content authored by someone else — and the operational states around them (power
on, standby, transitions). One section each, naming the threats from the threat model that act on it.
Use cases sharing a communication path and a security assessment may be documented together.

![Principal call flow](PROJECT_NAME.sec.usecase.svg)

## Traceability

Where the diagram-to-hazard-to-control-to-test chain lives, rather than a copy of it: each element is a
design unit or a SOUP/SBOM component, each threat names its `causes` and `controls`, and each control
is a requirement a test verifies.
