<!-- specpad:working-loop -->
## SpecPad — capture requirements as you build

This project uses **SpecPad**. Treat requirements and verification tests as a first-class output of
development, captured **spec-first** and attributed to a job — not written up afterward. Follow the
SpecPad working loop (see the specpad skill's `SKILL.md`):

1. Ensure an **active open job** (`docs/specpad/<name>.job.json` → `docs/specpad/<name>.jobs.json`).
2. Distill the intent we agree on into **SRS requirement(s) + a verifying VTP test** before/while you
   implement (`docs/specpad/<name>.srs.json` / `.vtp.json`); capture intent, not transcript.
3. Author the automated test where the behavior is automatable; keep governance clean.
4. Write the requirements/tests autonomously, then tell me the codes you captured so I can edit them.

Every commit must reference a job (a `Job:` trailer); the pre-push hook enforces it. A genuine
refactor or comment-only change with no requirement uses a `Spec: none <reason>` trailer.
<!-- /specpad:working-loop -->
