# CLAUDE.md — SpecPad

Guidance for Claude Code working in this repository.

## Dogfood rule — SpecPad governs SpecPad (read first)

<!-- specpad:working-loop -->
**SpecPad must follow its own process.** Any change to product behavior in this repo (the editor, the
skill, or the shared contract) is incomplete until it is recorded as requirements and verification
tests in `docs/specpad/specpad.srs.json` / `specpad.vtp.json`, attributed to an active job, **in the
same commit**. This is not optional and not deferrable: a feature with no requirement is a process
failure, exactly the thing SpecPad exists to prevent.

Follow the **SpecPad working loop** defined in `skill/specpad/SKILL.md` — capture requirements as you
build, **spec-first** (job → requirement → test → code), distilling the intent from our conversation
rather than batching the spec to the end. Write the requirements/tests autonomously, then tell me the
codes you captured so I can correct them.

Before committing feature work, confirm:
1. An **active open job** is set in `docs/specpad/specpad.job.json` (`jobs: ["j_…"]`).
2. New/changed behavior has matching **SRS requirements + VTP tests** (governance-clean: every
   requirement verified, every test has an expected result).
3. `npm test` and `npx tsc --noEmit` pass.

A pure refactor, typo, or non-behavioral change needs no SRS update — say so explicitly in the commit
rather than skipping silently. (Automated enforcement of this rule is tracked as JOBS-7/JOBS-8.)

## What SpecPad is

SpecPad is a **distributable product** with two co-governed halves:

1. A **Claude Code skill** (`skill/specpad/`) that creates and maintains structured
   software-documentation files — requirements (SRS), verification tests (VTP), and a project
   index — as JSON in the user's git repo.
2. A **hosted visual editor** (this React app, served versioned from `specpad.com/v01/`) that lets
   humans edit the same files through a full UI.

Both obey **one shared contract**: the v1 JSON schema plus a single validation/governance module in
`src/shared/`. The skill edits programmatically; humans edit visually; git is the history/merge layer.

The design spec is the source of truth for scope, schema, and the runtime/redirect model:
`docs/design/specpad-v1-design.md`.

## Layout

- `src/shared/` — the contract: `schema.ts` (types + JSON Schemas), `validate.ts`, `governance.ts`
  (`checkGovernance` + `GOVERNANCE_RULES`), `ids.ts`, `factories.ts`, barrel `index.ts`. Imported by
  the editor; mirrored in prose by the skill.
- `src/` — the editor: `index.tsx` → `LocalApp.tsx`; `localFileApi.ts` (File System Access API +
  upload/download fallback); `components/` (`SRSTable`, `VTPTable`, `TestingView`, `ValidationPanel`).
- `skill/specpad/` — the distributable skill (`SKILL.md`) + scaffolding `templates/`.
- `docs/specpad/` — SpecPad's own SRS/VTP/proj, authored with SpecPad (dogfood). Kept valid and
  governance-clean by `src/shared/__tests__/dogfood.test.ts`.
- `site/` — the marketing site (second Vite build → `dist-site/`) + the build-time-generated
  schema reference (`site/src/generate-reference.ts` imports the live contract).
- `docs/design/` — the v1 design spec.

## Key contract rules (do not regress)

- Stable `id` per item, generated and immutable; **all references (`verifies`) target `id`**, never
  human labels (`code`). Renames must never break links.
- **Git owns history** — no `modifiedUser`/`modifiedDate`/changelist/change-code fields.
- **Nothing derived is stored** — test counts and result roll-ups are computed on read.
- **JSON Schema enforces structure only.** Policy (traceability, referential integrity,
  expected-result presence) lives in `checkGovernance`, run by both the editor (`ValidationPanel`) and
  the skill — kept in sync by `skill/__tests__/parity.test.ts`.
- Every file carries `schemaVersion`; `"1.0"` → editor build path `/v01/`.

## Stack & commands

Static React 18 + TypeScript app, no backend for file ops. Build/test via Vite + Vitest.

```bash
npm install
npm run dev      # Vite dev server
npm test         # Vitest (contract + editor + dogfood)
npm run build    # production build → dist/ (deployed at specpad.com/v01/)
npm run lint
```

Prefer test-driven development, especially for the shared contract module. Run `npm test` and
`npx tsc --noEmit` before claiming work complete.

## Deployment

This repo is public (MIT). The site is live at `https://specpad.com/` (marketing at the apex,
editor at `/v01/`, demo at `/v01/?demo`, reference at `/reference/`) — S3 + CloudFront + Route 53.
**Deployment scripts and AWS resource identifiers live in the private `specpad-infra` repo**
(cloned as a sibling of this checkout; its `deploy.sh` builds from here). Never commit AWS
account ids, bucket names, or distribution ids to this repo.
The `schemaVersion` maps to the path (`"1.0"` → `/v01/`); old version paths stay live forever.
