# SpecPad server

A self-hosted server that lets staff **without source access** — quality and product managers —
edit a project's requirements and verification tests in the SpecPad editor, and publish their
changes back to the repository as ordinary git commits authored by them.

Design: [`docs/design/specpad-server-design.md`](../docs/design/specpad-server-design.md).
Requirements: `SRV-*`, `AUTH-*`, `CMT-*`, `CE-*`, `MRG-*`, `EDR-*` in `docs/specpad/specpad.srs.json`.

## What it is

- One process serving the version-pinned editor build **and** its API from a single origin.
- One bare clone, plus **one sparse-checked-out git worktree per user** — that worktree is the
  user's private draft (autosaved, uncommitted) until they press **Commit**.
- **No runtime dependencies.** Node's standard library plus the `git` binary. Nothing to audit
  beyond the code in this directory and the shared contract it imports.

## Running it

```bash
cp server/specpad-server.example.json ./specpad-server.config.json   # then edit it
npm run build                                                        # builds the editor into dist/
node --experimental-strip-types server/index.ts ./specpad-server.config.json
```

`SPECPAD_EDITOR_DIR` overrides where the editor build is served from (default `dist`).

For local development, set `auth.provider` to `dev` and `bind` to `127.0.0.1` — the dev provider
refuses to start on any other interface.

## Layout

| File | Role |
|---|---|
| `config.ts` | The declarative config, and exhaustive startup validation (SRV-6) |
| `auth.ts` | `AuthProvider` → one `Principal`; proxy / oidc / dev; role mapping (AUTH-1..6) |
| `paths.ts` | Path confinement — every function here is a security control (SRV-2) |
| `git.ts` | Git plumbing behind an injectable runner; never force-pushes |
| `repository.ts` | The bare clone and per-user sparse worktrees (SRV-3, CMT-1) |
| `workingCopy.ts` | Reads/writes, the commit pipeline, structural conflict resolution |
| `commitGate.ts` | Validation + governance + attribution, as a pure function (CMT-4, CMT-5) |
| `api.ts` | The HTTP surface, and the authorization enforcement point (SRV-4, EDR-3) |
| `index.ts` | Entry point: static editor + API on one origin (SRV-1) |

## Two things worth knowing

**Governance runs here, not in the browser.** `checkCommit` imports the same `validate` and
`checkGovernance` the editor and the skill use (SRV-5). A client can be bypassed; this cannot. For
someone who will never run `npm test`, this gate *is* the dogfood rule.

**SpecPad JSON is never merged textually.** A line-based merge of a formatted JSON array produces
plausible-looking garbage — duplicated ids, orphaned references, silently dropped items. Every
rebase conflict in an `*.srs.json` / `*.vtp.json` / `*.prd.json` is routed through
`mergeDocs` in `src/shared/merge.ts`, which aligns the two sides on stable item ids. Two people
editing different requirements never conflict at all.

Note the subtlety in `Git.conflictedFile`: during a *rebase*, git's index stages are inverted
relative to how a user thinks about them — stage 2 is the upstream branch and stage 3 is the commit
being replayed. We return them the way the user means them.

## Status

Implemented and tested: config validation, path confinement, the proxy and dev auth providers,
role mapping, the commit gate, the API surface and its authorization, optimistic concurrency,
and the structural merge.

Not yet implemented: the **OIDC provider** (use `proxy` behind your existing gateway — it throws a
message saying so), the **presence/event stream** (CE-3, CE-4), and the editor-side **Commit UI**
(EDR-2, CMT-3, CMT-7 and the conflict resolver). The `remote` transport entry in
`src/transports/__tests__/conformance.test.ts` lands with that UI.
