# Architecture authoring guide (generic)

> Soft authoring context for `PROJECT_NAME.sad.md` and `PROJECT_NAME.workspace.dsl`. The skill reads
> this before editing the architecture; the editor shows it alongside the doc. Edit it to fit your
> project — it's guidance, not enforced rules (rules live in governance).

- **Audience:** an engineer new to the project. Favour clarity over completeness.
- **Altitude:** describe *what the units do and how they interact*, not line-level implementation.
- **Keep it current:** update the SAD in the same job as the code change that affects it.
- **Diagrams carry the structure:** put units and interactions in the C4 model (`workspace.dsl`);
  keep the markdown for rationale and prose. Reference the views by name from the relevant sections.
- **Decisions:** when you make a load-bearing choice, record it in §9 (context → decision → consequences).
- **Tone:** plain, concrete, present tense. No marketing language.
