# SpecPad — Software Architecture Document (arc42)

> Architecture spec for SpecPad itself (dogfood). arc42 skeleton; the C4 model lives in
> `specpad.workspace.dsl`. Job/release-coupled — see the Jobs view for how each change affected this.

## 1. Introduction and Goals
SpecPad governs structured software documentation (requirements, verification tests, and — via this
document — architecture) as files in a git repo, edited by a Claude Code skill and a hosted visual
editor under one shared contract. Top goals: low install friction, a documentation digital-twin of the
code, and audit-grade design-controls evidence (IEC 62304) exportable to an eQMS.

## 2. Constraints
- Static, backend-less hosted editor (S3 + CloudFront); all file I/O is client-side (File System
  Access API) or git.
- One shared v1 JSON contract governs the editor and the skill; git owns history.
- Version-pinned editor builds (`schemaVersion "1.0"` → `/v01/`); old builds stay live.

## 3. Context and Scope
Actors: a **developer** (with Claude Code) authoring specs and code; a **reviewer** approving evidence
in the **eQMS**. SpecPad reads/writes `docs/specpad/` in the developer's git repo and exports evidence
to the eQMS. See the system-context view in `specpad.workspace.dsl`.

## 4. Solution Strategy
- **Contract-first:** `src/shared/` (schema, validate, governance, ids, factories, diff) is the single
  source of truth both halves obey.
- **Skill writes programmatically; humans edit visually; git merges.**
- **Change tracking is git-derived** (release baselines + frozen closed-job caches), so the
  browser-based editor can show history without git access.
- **Jobs are the change spine**: each job ties its SRS/VTP/architecture edits and code commits together.

## 5. Building Block View
- **Shared contract** (`src/shared/`) — types + JSON Schemas, governance rules, the id-keyed diff.
- **Editor** (`src/`) — React SPA: SRS/VTP tables, Testing view, Jobs view, this Architecture view;
  reads/writes files locally.
- **Skill** (`skill/specpad/`) — `SKILL.md` prose + git plumbing; scaffolds, governs, caches, exports.
- **Hosted site** — versioned static builds + marketing + reference. Containers detailed in the C4 DSL.

## 6. Runtime View
Working loop: define intent → skill captures requirements/tests (+ architecture) spec-first under an
active job → implement → pre-push hook enforces a `Job:` trailer → on close, the skill caches the job's
before/after spec + commit list. The editor diffs the caches to show each job's impact.

## 7. Deployment View
Private S3 bucket behind CloudFront (OAC), Route 53, ACM. Apex = marketing; `/v01/` = editor;
`/demo/` = demo content; `/staging/` = in-progress builds. Provisioned by the private `specpad-infra`
repo's `deploy.sh`.

## 8. Crosscutting Concepts
Stable immutable ids; references target ids never labels; nothing derived is stored except the
committed, regenerable "lockfile" caches; governance enforced identically by editor and skill.

## 9. Architecture Decisions
Key ADRs: hosted-only editor with a version-pinned redirect launcher; git-derived change tracking;
job-level coupling for architecture (no req↔arch matrix — see the traceability decision); architecture
authored as arc42 + Structurizr DSL rather than structured JSON, to keep the contract simple.

## 10. Quality Requirements
Install friction, contract integrity (editor ↔ skill parity), reproducibility of evidence
(deterministic, versioned, git-backed), and traceability (req↔test, job→code).

## 11. Risks and Technical Debt
Client-side C4 rendering is deferred (DSL shown as code + link-out); per-job architecture diffs accrue
only for jobs closed after this SAD exists; export format for the eQMS not yet finalized.

## 12. Glossary
SRS (requirements), VTP (verification tests), SAD (this document), SDD (detailed design — future),
Job (a design change), Release (a design checkpoint), eQMS (external quality system of record).
