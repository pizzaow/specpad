# PROJECT_NAME — Software Architecture Document (arc42, medical profile)

> Medical architecture profile, aligned with IEC 62304 and the FDA premarket software guidance. arc42
> skeleton. Diagrams are draw.io SVG exports placed inline via `![caption](PROJECT_NAME.<name>.svg)`; a
> Structurizr C4 model (`PROJECT_NAME.workspace.dsl`) is optional. Follow `PROJECT_NAME.sad.guide.md` for the
> regulatory authoring tact. Classification is a profile convention — every software unit carries a
> `class` (and where relevant a documentation level); do not invent a scheme here, use the project's.
> NOTE: third-party components (SOUP/OTS) are tracked in the separate components/SBOM register, not here.

## 1. Introduction and Goals
The software's purpose, intended use, and top quality goals. State the **overall safety classification**
(e.g. IEC 62304 Class A/B/C) and the **FDA Documentation Level** (Basic/Enhanced) for this software, with
the rationale, and reference the device risk management file.

## 2. Constraints
Regulatory, technical, and organizational constraints (62304 process, QMS procedures, platform, SOUP
policy). One bullet each.

## 3. Context and Scope
System boundary, external actors/systems, and the data crossing each interface (62304 §5.3.2).

![System context (C1)](PROJECT_NAME.context.svg)

## 4. Solution Strategy
The decisions that most shape the architecture, including how the design supports **risk control**.

## 5. Building Block View (software items and units)
The decomposition into **software items → units** (62304 §5.3.1), top-down, each with its **safety
classification** and key interfaces.

![Building block view](PROJECT_NAME.building-block.svg)

| Unit | Responsibility | Class | Interfaces |
|------|----------------|-------|------------|
| …    | …              | A/B/C | …          |

## 6. Safety classification & segregation
Per-unit classification rationale, and the **segregation/isolation between items used for risk control**
(62304 §5.3.5) — what is segregated, how, and how the segregation's effectiveness is assured. A
higher-class system may contain lower-class units only with justified, effective segregation.

## 7. Runtime View
Important scenarios as sequences, including risk-control and failure paths.

## 8. Deployment View
Mapping of software to infrastructure/hardware.

![Deployment view](PROJECT_NAME.deployment.svg)

## 9. Crosscutting Concepts
Error handling, persistence, security, logging, configuration — and how each supports the safety goals.

## 10. Architecture Decisions
Significant decisions (context → decision → consequences), especially those affecting safety/risk.

## 11. Architecture Verification
How the architecture is **verified to implement the software requirements**, support the interfaces, and
support risk control (62304 §5.3.6) — the verification activity and its evidence.

## 12. Quality Requirements, Risks, and Glossary
Testable quality scenarios; architectural risks and technical debt (with severity); and the glossary.
