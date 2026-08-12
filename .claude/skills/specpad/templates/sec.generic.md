# PROJECT_NAME — Security Architecture

> The four views a premarket submission is expected to contain (FDA, *Cybersecurity in Medical
> Devices*), with the security development lifecycle of IEC 81001-5-1 behind them. The threat model
> itself is `PROJECT_NAME.threat.json`; this document describes the system those threats act against.
> Where this and the architecture document describe the same structure, the architecture document is
> the source and this is the security reading of it.

## 1. Global system view

The system and every connection into and out of it: what is inside the perimeter, what is outside, and
which boundary each connection crosses. State where trust begins — what is authenticated, by what, and
what is believed without proof.

## 2. Multi-patient harm view

How an attack on one instance could reach beyond it. If the product has no fleet and no patient-facing
function, say so plainly and state the indirect harm path rather than dismissing the view — an auditor
reads its absence as an omission and its dismissal as an argument.

## 3. Updateability and patchability view

How a fix reaches a deployed instance, end to end: who builds it, who installs it, how long that takes,
and what an operator who does nothing stays on. Name the state on disk and what an update does to it.

## 4. Security use cases

The flows where an attacker's interest and the system's function meet — signing in, reading, writing,
publishing, rendering content authored by someone else. One short section each, naming the threats from
the threat model that act on it.
