<!-- specpad:working-loop -->
## SpecPad — capture requirements as you build

This project uses **SpecPad**. Treat requirements and verification tests as a first-class output of
development, captured **spec-first** and attributed to a job — not written up afterward. Follow the
SpecPad working loop (see the specpad skill's `SKILL.md`):

1. Ensure an **active open job** (`docs/specpad/<name>.job.json` → `docs/specpad/<name>.jobs.json`).
2. **Evaluate the job's impact on every registered document type** — requirements (SRS) + a verifying
   VTP test, and also the **product requirements (PRD)** if user-facing intent changed and the
   **architecture (SAD + diagrams)** if a component/module/interface/contract changed (and any other
   pillar). Update each affected one spec-first; capture intent, not transcript. Most jobs touch
   SRS/VTP; structural changes also touch the SAD — don't let it drift.
3. Author the automated test where the behavior is automatable; keep governance clean.
4. Write the updates autonomously, then tell me the codes you captured and which document types you
   touched, so I can correct them.

Every commit must reference a job (a `Job:` trailer); the pre-push hook enforces it. A genuine
refactor or comment-only change with no requirement uses a `Spec: none <reason>` trailer.
<!-- /specpad:working-loop -->
