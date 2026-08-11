# Architecture authoring guide (SpecPad — generic)

> Soft authoring context for `specpad.sad.md` and `specpad.workspace.dsl`. The skill reads this before
> editing the architecture; the editor shows it alongside the doc. Guidance, not enforced rules.

- **Audience:** an engineer new to SpecPad. Clarity over completeness.
- **Altitude:** describe what the units (shared contract, editor, skill, repo/cache) do and how they
  interact — not line-level implementation.
- **Keep it current:** update the SAD in the same job as the change that affects it (this file is
  itself dogfood — SpecPad governs SpecPad).
- **Diagrams carry the structure:** units and interactions live in `specpad.workspace.dsl`; the markdown
  carries rationale. Reference the views (Context / Containers / Components) by name.
- **Decisions:** record load-bearing choices in §9 (context → decision → consequences).
- **Tone:** plain, concrete, present tense.
