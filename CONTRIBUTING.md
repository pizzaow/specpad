# Contributing to SpecPad

Thanks for your interest! SpecPad is small and opinionated; this page tells you what we won't
bend on and how to land a change.

## Setup

```bash
npm install
npm test            # full suite: contract + editor + skill parity + dogfood docs
npx tsc --noEmit    # type check
npm run lint
```

All three must be green before a PR is reviewed. Prefer test-driven development, especially for
anything in `src/shared/`.

## The contract rules (do not regress)

The whole product hangs on a few invariants. PRs that break them will be declined regardless of
how nice the feature is:

1. **Stable ids.** Every item's `id` is generated once and never changed; all cross-references
   (`verifies`) target `id`, never the human-facing `code`. Renames must never break links.
2. **Git owns history.** No `modifiedUser`/`modifiedDate`/changelist fields in any document.
   Attribution and history come from commits and tags.
3. **Nothing derived is stored.** Test counts, coverage roll-ups, and redlines are computed on
   read, never written to disk.
4. **Structure vs policy.** JSON Schema (`validate`) enforces structure only. Policy —
   traceability, referential integrity, expected-result presence — lives in `checkGovernance`,
   which runs identically in the editor and the skill. `skill/__tests__/parity.test.ts` keeps the
   skill's prose in sync with the code; if you change governance, change both.
5. **`schemaVersion` pins the editor.** `"1.0"` documents open at `/v01/`. Schema changes that
   aren't strictly additive require a new schema version and a new versioned build path — talk to
   the maintainer first by opening an issue.
6. **Every schema field carries a `description`.** The public reference page is generated from
   them; `schema-descriptions.test.ts` fails the build on an undocumented field.

## Dogfood rule

SpecPad documents itself. If your change adds or alters user-facing behavior, update
`docs/specpad/specpad.srs.json` and `specpad.vtp.json` in the same PR — fresh ids, next codes,
`verifies` by id, following `skill/specpad/SKILL.md` conventions. The dogfood test keeps these
files valid and governance-clean.

## Submitting changes

1. Fork/branch from `main`.
2. Keep PRs focused — one feature or fix per PR.
3. Make sure `npm test`, `npx tsc --noEmit`, and `npm run lint` pass.
4. If you touched the editor UI, re-run `npm run capture:screenshots` only if asked — the
   committed marketing screenshots are refreshed by the maintainer at release time.
5. Open a PR with a clear description of what changed and why.

## What lives where

- `src/shared/` — the contract (schemas, validate, governance, ids, factories). Highest review bar.
- `src/` — the React editor.
- `skill/specpad/` — the distributable Claude Code skill (`SKILL.md` + templates).
- `site/` — marketing site and the generated schema reference.
- `docs/design/` — design specs; `docs/specpad/` — SpecPad's own spec (dogfood).

Deployment (AWS, CloudFront, DNS) is maintained privately by the project owner; contributors
don't need any of it — `npm run dev` and `npm run dev:site` cover local development entirely.

## Questions

Open a GitHub issue. For security-sensitive reports, please use GitHub's private vulnerability
reporting rather than a public issue.
