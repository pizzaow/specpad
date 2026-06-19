---
name: specpad-medical
description: Medical/regulated add-on for SpecPad — IEC 62304 + FDA premarket software design controls. Use ON TOP OF the core `specpad` skill when a project is a medical device (or otherwise regulated). Adds the medical architecture profile (per-unit safety classification, segregation, verification), regulatory governance, and the formal design-controls export. Triggers on "62304", "design controls", "medical device", "safety classification", "FDA premarket", "generate release documents".
---

# SpecPad — medical / regulated add-on

This **extends** the core `specpad` skill; it does not replace it. Core provides the contract,
requirements/tests, jobs/change-tracking, the working loop, the editor, and the **generic** architecture
profile. This add-on layers the **regulated** parts on top. Keep it installed only for projects that
need it — that is the point of the split (the regulated layer's token cost is paid only when opted in).

**Unchanged by this add-on:** the JSON contract (`src/shared`) and the editor are **one shared
codebase**; this skill adds *prose, templates, and governance*, never a code fork. The editor lights up
medical features (e.g. classification display) only when a medical profile is present.

## When to use
A project is a **medical device** (or under a comparable regulated QMS) and wants its SpecPad
documentation to serve as **design-controls evidence** (IEC 62304, FDA premarket software guidance),
exported to an external eQMS for formal review/approval. (SpecPad is the source/export; the eQMS owns
sign-off — do not rebuild eQMS workflow here.)

## Architecture — the medical profile
Use this add-on's templates instead of core's generic ones for the SAD:
- `templates/sad.md` → `<name>.sad.md` (arc42 + the 62304/FDA sections).
- `templates/sad.guide.md` → `<name>.sad.guide.md` (the regulatory authoring tact the skill reads
  before editing the SAD).

**Classification is a profile convention, not a hard-coded field.** Don't bake A/B/C in:
- **IEC 62304 safety class** (A/B/C) is **per software unit** — each architecture unit (a C4 element, or
  a row in the building-block table) carries a `class`, with segregation justified where a higher-class
  system contains lower-class units (62304 §5.3.5).
- **FDA Documentation Level** (Basic/Enhanced) is **per software function / system**, set once.
- A project may carry both axes; the coming 62304 revision (draft) trends toward basic/enhanced — a
  profile absorbs it without changing core.

## Regulatory governance (skill-side, convention-keyed)
Architecture governance can't run in the browser (it doesn't parse the SAD), so it is **skill-side** —
check it before declaring work done, keyed to **conventions, never wording** (so customization survives):
- Every software unit carries a **`class`** (or the project's classification scheme).
- The SAD has the **segregation** and **architecture-verification** sections (by anchor).
- Architecture is **job/release-coupled** (no requirement↔architecture trace matrix — not required by
  62304; the arc42 prose states that the architecture implements the requirements).

## Traceability (62304 §5.7.4)
The required trace is **requirements ↔ system tests ↔ risk control measures** — NOT req↔architecture.
Req↔test is core (`verifies`); job→code is free (the `Job:` trailer). Risk-control linkage is a future
addition. Do not maintain a req↔arch matrix.

## Coming-soon pillars (not built yet)
- **Generate release documents** — the formal **Word/docx** export merging content into the company's
  document template (styles/headers/footers/cover/approval), with embedded diagram images; this is the
  eQMS deliverable, and redlined-Word between releases is the hard follow-up.
- **3rd-party components / SBOM** (SOUP/OTS) — a separate register, SBOM-aligned, likely derivable from
  dependency manifests; the SAD references it, never contains it.
- **Cybersecurity architecture** — a companion pillar, much of it derivable.
