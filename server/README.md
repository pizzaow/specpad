# SpecPad server

A self-hosted server that lets staff **without source access** — quality and product managers —
edit a project's requirements and verification tests in the SpecPad editor, and publish their
changes back to the repository as ordinary git commits authored by them.

One server hosts **several projects** (`MPT-*`): a company with SpecPad in six repositories runs
one deployment, one sign-on, and permissions granted per project.

Design: [`docs/design/specpad-server-design.md`](../docs/design/specpad-server-design.md).
Requirements: `SRV-*`, `AUTH-*`, `CMT-*`, `CE-*`, `MRG-*`, `EDR-*`, `MPT-*` in
`docs/specpad/specpad.srs.json`.

## What it is

- One process serving the version-pinned editor build **and** its API from a single origin.
- Per project: one bare clone, plus **one sparse-checked-out git worktree per user** — that
  worktree is the user's private draft (autosaved, uncommitted) until they press **Commit**.
- **No runtime dependencies.** Node's standard library plus the `git` binary. Nothing to audit
  beyond the code in this directory and the shared contract it imports.

## Running it

```bash
cp server/specpad-server.example.json ./specpad-server.config.json   # then edit it
npm run build                                                        # builds the editor into dist/
npm run server -- ./specpad-server.config.json
```

`SPECPAD_EDITOR_DIR` overrides where the editor build is served from (default `dist`).

An invalid configuration is refused at startup with every problem listed and a non-zero exit code —
the server never comes up half-configured, because it holds push access to a real repository.

For local development, set `auth.provider` to `dev` and `bind` to `127.0.0.1` — the dev provider
refuses to start on any other interface.

### In a container

```bash
docker build -t specpad-server .
docker run -p 8080:8080 \
  -v /srv/specpad:/srv/specpad \
  -v $PWD/specpad-server.config.json:/etc/specpad/config.json:ro \
  -v ~/.ssh/deploy-key:/run/secrets/specpad-deploy-key:ro \
  specpad-server
```

The image runs the same entry point `npm run server` does. `/srv/specpad` holds the bare clone and
per-user worktrees, so keep it on a volume that outlives the container.

## Layout

| File | Role |
|---|---|
| `config.ts` | The declarative config, and exhaustive startup validation (SRV-6) |
| `auth.ts` | `AuthProvider` → one `Principal`; proxy / oidc / dev; role mapping (AUTH-1..6) |
| `paths.ts` | Path confinement — every function here is a security control (SRV-2) |
| `git.ts` | Git plumbing behind an injectable runner; never force-pushes |
| `repository.ts` | One project's bare clone and per-user sparse worktrees (SRV-3, CMT-1, MPT-4) |
| `registry.ts` | The hosted projects and their per-project runtime (MPT-1, MPT-8, WCL-1) |
| `routing.ts` | Which project a request is for (MPT-3) |
| `workingCopy.ts` | Reads/writes, the commit pipeline, structural conflict resolution |
| `commitGate.ts` | Validation + governance + attribution, as a pure function (CMT-4, CMT-5) |
| `api.ts` | The HTTP surface, and the authorization enforcement point (SRV-4, EDR-3) |
| `index.ts` | Entry point: static editor + API on one origin (SRV-1) |

## Several projects, one server

`projects: [...]` declares them; each entry carries its own repository, branch, allowlisted paths
and credential, and may override the server-wide `roles` and `commit` policy (MPT-5). The older
single-repository shape (`repo: {...}` at the root) is still valid and reads as a one-project
deployment (MPT-2) — an existing config needs no edit.

| Route | Meaning |
|---|---|
| `GET /api/v1/projects` | The projects the caller may read, with their role in each (MPT-7) |
| `/api/v1/p/<id>/…` | The API, within one project (MPT-3) |
| `/api/v1/…` | The same, when the deployment has exactly one project |

Each project gets its own directory under `workDir/projects/<id>` holding its clone and its
per-user worktrees, so two projects can never share a working copy (MPT-4), and its own presence
registry and event stream, so an editing claim in one project does not wake the other's editors
(MPT-8). A principal with no role in a project is refused **that** project and keeps the rest
(MPT-6).

A repository's launcher opens its own project by setting `editorProjectId` in the project index
alongside `editorBaseUrl` (MPT-10); the editor also accepts `?project=<id>` directly. Reaching a
multi-project server without naming one offers the project list rather than an arbitrary choice.
Once inside, the server bar carries a **project switcher** (MPT-11): choosing another project
reloads the editor from it and rewrites the URL, so a refresh stays where you are.

## Idle working copies

A checkout per user per project accumulates — six projects and forty staff is 240 sparse worktrees.
`workingCopies.idleTimeout` (default 24h, `0` disables) is how long one may sit unused before a
sweep removes it; `sweepInterval` (default 1h) is how often that sweep runs.

Two things reaping will never do. It never removes a copy holding **uncommitted changes** (WCL-2):
that work exists in no git object anywhere, so reaping it would destroy it, and "they went home" is
not consent. And it never removes a copy the process has not seen used — after a restart, every
worktree is treated as used *now*, so a restart costs one extra idle period rather than a sweep that
deletes everyone's drafts. A reaped copy is re-provisioned on next use (WCL-3), so a user who
returns sees nothing but the committed state.

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

## How the editor finds it

The editor probes `GET /api/v1/session` on load — beneath `/p/<id>` when the URL named a project.
A session response means a server is serving the page, so it switches to the remote transport,
opens that project, and shows the signed-in identity — no folder picker, no configuration. Anything else (a 404, or a static host
answering with the SPA's `index.html`) falls through to the demo or local-file paths, so the
public hosted editor is unaffected. The probe checks for JSON *and* a session shape, because a
200 carrying HTML is exactly what a static host returns for an unknown path.

## Status

Implemented and tested: config validation, path confinement, the proxy and dev auth providers,
role mapping, the commit gate, the API surface and its authorization, optimistic concurrency, the
structural merge, the remote transport, and the editor's server bar and Commit dialog.

All three transports (local, demo, remote) pass one shared conformance suite in
`src/transports/__tests__/conformance.test.ts`.

The process itself is covered by `server/__tests__/boot.integration.test.ts`, which starts the
server from a config file and drives it over HTTP from session probe to a commit on the branch, and
by `repository.integration.test.ts`, which exercises the git pipeline against a real repository.

Presence and the upstream-moved signal ride an SSE stream at `GET /api/v1/events`. Both are
deliberately weak: claims expire on their own after 45s, nothing blocks on them, and losing the
registry to a restart costs a moment of silence and nothing else. The server ends open streams
before closing, so SIGTERM does not hang.

Multi-project tenancy is covered by `server/__tests__/multiProject.test.ts` (config, routing,
per-project authorization) and `multiProject.integration.test.ts`, which runs two real repositories
through one process over HTTP.

Not yet implemented: the **OIDC provider** (use `proxy` behind your existing gateway — it throws a
message saying so) and an **in-place conflict resolver**. Today a conflict is reported per field with both values shown, and the user reloads,
reapplies, and commits again — correct and safe, but more work for them than picking a side in the
table would be.

**The `Dockerfile` has not been built or run** — no Docker was available in the environment it was
written in. `npm run server` is verified; the container packages that same command, but treat the
image as untested until someone builds it.
