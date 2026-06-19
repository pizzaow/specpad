# PROJECT_NAME — Software Architecture Document (arc42)

> Generic architecture profile. arc42 skeleton. **Diagrams are draw.io SVG exports, placed inline by
> this document** via `![caption](PROJECT_NAME.<name>.svg)`; a Structurizr C4 model
> (`PROJECT_NAME.workspace.dsl`) is an optional alternative. Job/release-coupled — the Jobs view shows
> how each change affected this. Replace the guidance under each heading. No safety classification here.

## 1. Introduction and Goals
What the system does, its top 3–5 quality goals, and the key stakeholders. Keep it to the essentials a
new engineer needs before reading the rest.

## 2. Constraints
Technical and organizational constraints that shape the architecture (platforms, languages, runtime,
compliance, team boundaries). One bullet each.

## 3. Context and Scope
The system's boundary: external actors and systems it talks to, and the data crossing each boundary.

![System context (C1)](PROJECT_NAME.context.svg)

## 4. Solution Strategy
The handful of decisions that most shape the architecture (decomposition approach, key patterns,
technology choices) and why. Link to ADRs in §9.

## 5. Building Block View
The static decomposition into **units** (modules/services/components) and their responsibilities and
**key interfaces**, top-down.

![Building block view](PROJECT_NAME.building-block.svg)

| Unit | Responsibility | Key interfaces |
|------|----------------|----------------|
| …    | …              | …              |

## 6. Runtime View
2–4 important scenarios as sequences (startup, the main use case, a failure path).

![Runtime view](PROJECT_NAME.runtime.svg)

## 7. Deployment View
How the software maps to infrastructure (environments, nodes, networking).

![Deployment view](PROJECT_NAME.deployment.svg)

## 8. Crosscutting Concepts
Patterns and rules that apply across units: error handling, persistence, security, logging,
configuration, i18n. One short subsection each that matters.

## 9. Architecture Decisions
The significant decisions (ADR-style): context → decision → consequences. List the most load-bearing.

## 10. Quality Requirements
A quality tree / scenarios for the goals in §1 (performance, reliability, maintainability, security …),
phrased so they're testable.

## 11. Risks and Technical Debt
Known architectural risks and debt, with rough severity and any mitigation.

## 12. Glossary
Domain and technical terms used in this document.
