# Architecture authoring guide (medical — IEC 62304 / FDA)

> Soft authoring context for `PROJECT_NAME.sad.md` and `PROJECT_NAME.workspace.dsl`. The skill reads
> this before editing the architecture; the editor shows it alongside the doc. Tailor it to your QMS —
> it's guidance, not enforced rules (the profile's governance enforces the hard ones).

- **Tone:** formal, precise, conservative. Use IEC 62304 / FDA terminology consistently (software
  system, software item, software unit, SOUP/OTS, risk control, documentation level).
- **Classify everything:** every software unit carries a `class` (e.g. A/B/C); state the rationale.
  If a higher-class system contains lower-class units, document the **segregation** that justifies it
  (§6) and how its effectiveness is assured (62304 §5.3.5).
- **Trace to intent, not a matrix:** show in prose that the architecture *implements* the requirements
  and *supports risk control* (§11 verification). Do not hand-maintain a requirement↔unit matrix.
- **Interfaces:** document every interface between items and to external systems (62304 §5.3.2).
- **SOUP/OTS:** do **not** inventory third-party components here — reference the separate
  components/SBOM register (coming soon). Keep the SAD about *your* software's structure.
- **Be audit-minded:** every claim should be defensible and consistent with the risk management file;
  the eQMS owns formal review/approval — this document is the source for that export.
