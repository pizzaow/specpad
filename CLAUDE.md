# CLAUDE.md — SpecPad

Guidance for Claude Code working in this repository.

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

## Remaining work

Cloud deployment is not done: S3 + CloudFront on `specpad.com` (Route 53 hosted zone, bucket with
OAC, ACM cert in us-east-1, A/ALIAS record). See design spec §5.4.
