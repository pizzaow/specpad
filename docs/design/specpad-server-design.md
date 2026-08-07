# SpecPad — Multi-User Server (Self-Hosted) — Design

**Date:** 2026-08-06
**Status:** Approved for implementation
**Builds on:** `docs/design/specpad-v1-design.md` (contract, runtime, redirect model),
`docs/design/specpad-change-tracking-design.md` (git-derived history, jobs, caches)

## 1. Purpose

Today SpecPad's editor reaches the spec files through the browser's File System Access API: the user
picks a folder on their own disk, in their own clone of the repo. That model is exactly right for a
developer and impossible for everyone else. A quality manager or product manager with no source
access, no clone, and no git client cannot open the editor at all — so the people best placed to
clarify a requirement or sharpen an expected result are locked out of the register that governs them.

This feature adds a **second way to reach the same files**: a small, self-hosted server that owns a
git clone of the repo, serves the editor, and exposes **only `docs/specpad/`** over an HTTP API.
Non-developers sign in through their company's existing SSO, edit requirements and tests in the same
UI developers use, and press **Commit** to push their changes back to the repo as a normal git
commit authored by them.

Nothing about the contract changes. The server is a third client of the same schema, the same
`checkGovernance`, and the same git history — it is a *transport*, not a new source of truth.

### In scope

1. A **transport seam** in the editor so the same UI can run against local files or a remote server.
2. A **self-hosted server** that owns a git clone, serves the editor, and mediates reads/writes.
3. A **per-user working copy** with autosave, and an explicit **Commit** action that pushes.
4. **Item-level three-way merge** so concurrent editors do not clobber each other.
5. An **identity-agnostic** authentication adapter, with corporate SSO as the first target.
6. **Governance enforced server-side** as a gate on commit.

### Explicitly out of scope

- Multi-tenant SaaS hosting, billing, or storing customers' source on specpad.com infrastructure.
- Real-time character-by-character co-editing (see §6.5 — deliberately rejected).
- Editing anything outside `docs/specpad/`, ever.
- Replacing the File System Access API path. Local mode remains the developer's mode, permanently.

## 2. Core idea

**The server is a git working copy with an HTTP front door, and the schema's stable ids make
concurrent editing safe.**

Three properties the v1 contract already guarantees do all the heavy lifting:

- **Every item has a stable, immutable `id`,** and every reference (`verifies`, `satisfies`) targets
  that id rather than a human label. So two documents can be aligned item-by-item without heuristics.
- **Nothing derived is stored.** No counters or roll-ups to reconcile — merging items merges the
  whole truth of the document.
- **Git owns history.** The server never invents a history model; it makes commits, and every
  existing read-side feature (redline, attribution, jobs, releases) keeps working untouched.

Together these mean a **three-way merge at item granularity** is both simple and safe. Two people
editing different requirements in the same SRS never conflict at all. That is the difference between
a spec server that feels safe and one that feels haunted.

## 3. Architecture

```
      Browser (the same editor build)
              │  https, same origin
              ▼
┌─────────────────────────────────────────────┐
│  specpad-server (one container)             │
│                                             │
│   /v01/      static editor build            │
│   /api/v1/   REST + SSE                     │
│                                             │
│   ┌───────────┐  ┌──────────────────────┐   │
│   │ auth      │  │ working-copy manager │   │
│   │ adapter   │  │  (git worktrees)     │   │
│   └───────────┘  └──────────────────────┘   │
│         imports src/shared (the contract)   │
└─────────────────────────────────────────────┘
              │  git fetch / push (machine credential)
              ▼
        the company's git host
```

Requests arrive already authenticated (§5). Reads and writes land in the requesting user's own git
worktree. Commit validates, runs governance, commits as the human, rebases, and pushes.

### 3.1 Why the editor is served by the server

The container serves the static editor build itself, at the same version path convention the hosted
editor uses (`schemaVersion "1.0"` → `/v01/`). Same origin means no CORS, no third-party cookies, no
cross-domain OAuth redirects, and no dependency on specpad.com being reachable from inside a
corporate network. Version pinning is preserved: a server bundles the editor builds it supports, and
old paths keep working.

Consequence: the launcher `index.html` the skill generates in `docs/specpad/` must be able to point
at a configured editor base URL instead of hardcoding `specpad.com`.

## 4. The working copy and the Commit button

### 4.1 Layout

```
/srv/specpad/
  repo.git/              bare clone; fetched on a timer and before every commit
  work/<userId>/         one git worktree per user, sparse-checkout: docs/specpad/
```

A **worktree per user**, checked out at the configured target branch, is the whole state model.
`git status` in that worktree *is* the user's uncommitted change set, which means the Commit
button's badge, the pre-commit diff summary, and the existing redline view all come from machinery
that already exists rather than a bespoke draft store.

**Sparse-checkout is a security control, not an optimization.** With `docs/specpad/` as the only
cone, the working tree physically cannot contain application source, so a path-handling bug cannot
write to it. The commit path re-verifies that the staged diff touches nothing outside the allowlist
— belt and braces, because the server holds push access to a real repository.

### 4.2 Autosave versus commit

| Action | Effect |
|---|---|
| Edit a field | Debounced write into the user's worktree. No commit, no lock, no push. |
| Leave and come back | Worktree still dirty; work resumes exactly where it was. |
| **Commit** | Validate → govern → commit as the user → fetch → rebase → push. |
| Discard | `git checkout -- docs/specpad` in that worktree. |

Autosave-without-commit is what makes the server usable by a non-developer: a half-formed thought
can sit overnight without polluting anyone's history, and a browser crash costs nothing.

### 4.3 The commit pipeline

1. **Structural validation** of every dirty document (`validate.ts`). A structurally invalid document
   is never committed.
2. **Governance** (`checkGovernance`) over the resulting bundle. Policy decides whether violations
   block or merely warn (§7.2), and whether an active job is required.
3. **Commit** in the user's worktree, `Author: <display name> <email>` from the authenticated
   principal, committer the server's machine identity. A `Job:` trailer is added for each active job,
   exactly as the skill writes it, so `computeAttribution` and the jobs views keep working.
4. **Fetch and rebase** onto the target branch. Clean rebase → step 6.
5. **Conflict** → structural merge (§6). Auto-resolvable → continue. Otherwise return a conflict
   report and leave the worktree in a recoverable state.
6. **Push.** On non-fast-forward (someone pushed between our fetch and our push), retry from step 4,
   bounded; a persistent failure is reported rather than force-pushed. The server never force-pushes.

Authorship is the crucial detail: the *identity* comes from SSO and lands in the commit's author
field, while the *push credential* is a single machine credential (§5.3). Blame, attribution, and
release notes therefore name the human who made the change.

## 5. Identity — agnostic by not implementing authentication

The server defines one internal type and refuses to care where it came from:

```ts
interface Principal {
  id: string;            // stable, opaque
  displayName: string;   // commit author name
  email: string;         // commit author email
  groups: string[];      // raw group/role claims from the provider
}

interface AuthProvider {
  authenticate(req): Promise<Principal | null>;
  getGitCredential?(p: Principal): Promise<GitCredential | null>;  // optional, see §5.3
}
```

### 5.1 Shipped providers

| Provider | How it identifies the user | When to use |
|---|---|---|
| `proxy` **(default)** | Trusted headers (`X-Forwarded-Email`, `-User`, `-Groups`) injected by an upstream. | Anything the company already runs: oauth2-proxy, Entra App Proxy, Cloudflare Access, Okta, SAML gateways, mTLS. |
| `oidc` | Standard OIDC authorization-code flow. | Entra / Okta / Google Workspace with no proxy in front. |
| `dev` | One fixed fake user. | Local development only. |

The `proxy` provider is the reason this design is genuinely identity-agnostic: for most enterprises
SpecPad implements *no* authentication, and inherits whatever the company already trusts. Because
header trust is forgeable by anyone who can reach the port directly, the provider **must** reject
identity headers from any peer other than the configured upstream, and the server must refuse to
start with `proxy` configured and no trusted-peer setting.

The `dev` provider must refuse to start when bound to a non-loopback interface. A convenience that
can be reached from the network is a vulnerability.

**Implementation status:** `proxy` and `dev` are implemented. `oidc` is not — it throws a message
pointing at `proxy`, which already covers OIDC, SAML, and mTLS through whatever gateway the company
runs. Failing loudly at first sign-in beats a silent denial that looks like a permissions bug.

### 5.2 Authorization

Group claims map to three project roles in config:

- **reader** — read everything; the editor renders read-only.
- **editor** — edit the working copy; cannot commit.
- **committer** — everything, including push.

A principal matching no mapping gets no access. Roles are coarse on purpose: field-level permissions
would need a permission model richer than the thing being permissioned.

### 5.3 Identity is not the git credential

By default the server pushes with one machine credential (deploy key, or a GitHub/GitLab App
installation token) configured once by the operator. The human identity travels in the commit author
field.

The optional `getGitCredential` hook is the seam for a future git-host-OAuth provider, which would
return the signed-in user's own token so pushes carry their git-host permissions. Nothing else in
the server changes — which is what "agnostic" has to mean to be worth claiming.

## 6. Concurrency and merge

### 6.1 Optimistic concurrency (the floor)

Every document read returns a version tag; every write carries it back. A mismatch is rejected with
a conflict status and the client refetches. This alone makes lost updates impossible, and it is the
backstop under everything else in this section.

### 6.2 Writes are item operations, not whole documents

The client sends operations — upsert item, delete item, reorder — rather than PUTting an entire
document it may have loaded minutes ago. The server applies them to the current working-copy state.
Two people editing different requirements in one SRS then generate non-overlapping operations and
never contend, even before either has pressed Commit.

### 6.3 Item-level three-way merge

Lives in `src/shared/merge.ts`, beside `diff.ts`, because it is contract knowledge — the skill, the
server, and a future `.gitattributes` merge driver must all agree on it. Pure: no git, no I/O.

Given `base` (the merge-base version), `ours`, and `theirs`, keyed on item `id`:

| Situation | Resolution |
|---|---|
| Item changed on one side only | Take that side. |
| Item added on one side only | Keep it. |
| Same item, different fields changed | Merge field-by-field — no conflict. |
| Same item, same field, same new value | Take it — no conflict. |
| Same item, same field, different values | **Conflict**, reported per field. |
| Deleted one side, unchanged the other | Delete. |
| Deleted one side, modified the other | **Conflict** — deletion never silently wins. |
| Order differs | Reconcile positions; ordering alone is never a conflict. |

Worked example — the case that motivates the whole design:

```
base    r_a101 { text: "The system shall store …", tags: ["schema"] }
ours    r_a101 { text: "The system shall store …", tags: ["schema", "core"] }
theirs  r_a101 { text: "The system shall persist …", tags: ["schema"] }
merged  r_a101 { text: "The system shall persist …", tags: ["schema", "core"] }   ← no conflict
```

and the case that must not auto-resolve:

```
base    r_a101.text = "… shall store …"
ours    r_a101.text = "… shall persist …"
theirs  r_a101.text = "… shall retain …"
result  CONFLICT on r_a101.text — both values returned for the user to choose
```

**SpecPad JSON is never merged textually.** A line-based merge of a formatted JSON array produces
plausible-looking garbage — duplicated ids, orphaned references, silently dropped items. The commit
pipeline routes every conflict in a `*.srs.json` / `*.vtp.json` / `*.prd.json` through this module.

### 6.4 Presence

An SSE channel carries two things:

- **Who is editing what** — advisory row claims, released on blur or timeout, so a second editor sees
  "Jane is editing REQ-14" rather than discovering it at commit time.
- **Upstream moved** — a signal that the target branch advanced, so nobody spends an hour refining a
  requirement that was rewritten twenty minutes ago.

Claims are advisory only. Correctness lives in §6.1–6.3; presence prevents *surprise*, not
corruption. A lock that can be lost by closing a laptop lid must never be load-bearing.

### 6.5 What we are not building

Real-time CRDT co-editing. Requirements work is document-shaped and low-frequency, per-keystroke
convergence has no honest mapping onto git commits, and the explicit Commit button is a *feature* —
it is the moment a change becomes a reviewable fact. Rejecting this is a design decision, not a
deferral.

## 7. Configuration and deployment

### 7.1 Shape

One container image, one config file, no database. The operator supplies a repo URL, a branch, a
credential, an auth provider, and a group→role map. There is no tenant table and no customer source
stored anywhere but the customer's own infrastructure — which is what makes the thing approvable
inside a corporate network.

### 7.2 Config

JSON rather than YAML, so the server needs no parser dependency — it runs on Node's
standard library alone (`node:http`, `node:child_process`, `node:crypto`). A spec server
with no supply chain is easier to get through a security review than one with fifty
transitive dependencies, and the config is short enough that YAML buys little.

```jsonc
{
  "repo": {
    "url": "git@git.corp.internal:product/acme.git",
    "branch": "main",
    "credentialFile": "/run/secrets/specpad-deploy-key",
    "paths": ["docs/specpad/"]           // allowlist; also the sparse-checkout cone
  },
  "auth": {
    "provider": "proxy",                 // proxy | oidc | dev
    "trustedPeers": ["10.0.0.0/8"],
    "roles": {
      "committer": ["grp-product-managers", "grp-quality"],
      "editor":    ["grp-engineering"],
      "reader":    ["grp-all-staff"]
    }
  },
  "commit": {
    "requireActiveJob": true,
    "requireGovernanceClean": "warn",    // block | warn | off
    "pushRetries": 3
  },
  "workDir": "/srv/specpad",
  "port": 8080,
  "bind": "0.0.0.0"
}
```

See `server/specpad-server.example.json`. Every problem is reported at once and startup
is refused — including the two conditions that are security bugs rather than typos:
`proxy` with no `trustedPeers`, and `dev` on a non-loopback bind.

### 7.3 Where the code lives

The server is a workspace **in this repository**, not a separate one. It imports `src/shared`
directly, so a parity test — mirroring `skill/__tests__/parity.test.ts` — can prove the server, the
editor, and the skill enforce one contract. Deployment scripts and real resource identifiers stay in
the private infra repo, per the existing rule.

## 8. API surface

Every endpoint mirrors an existing `localFileApi` capability, which is what keeps the seam honest.

```
GET  /api/v1/session               principal, roles, repo, branch, active job, editor version
GET  /api/v1/documents             document list (a real listing — no manifest.json substitute)
GET  /api/v1/doc/:filename         document + version tag
POST /api/v1/doc/:filename/ops     apply item operations to the working copy
GET  /api/v1/status                dirty files + item-level diff summary (the Commit badge)
POST /api/v1/commit                {message} → validate, govern, commit, rebase, push
POST /api/v1/discard               revert the working copy
GET  /api/v1/history/…             snapshots, job caches, releases (read-only passthrough)
GET  /api/v1/events                SSE: presence, upstream-changed
```

Writes are rejected outright for the `reader` role and for `editor` on `/commit`; the UI's read-only
rendering is a courtesy, not the enforcement point.

## 9. Editor changes

1. **`FileApi` interface** — the existing `localFileApi` module surface, formalized. Three
   implementations: `localFileApi` (File System Access), `demoFileApi` (read-only HTTP; already
   effectively this shape), and `remoteFileApi` (the server). `LocalApp` receives one via context
   instead of importing the module directly. This is the bulk of the work and it is mechanical.
2. **Commit UI** — identity chip, Commit button with a dirty badge, a commit dialog showing the
   item-level diff summary and the governance result, and a conflict resolver offering yours/theirs
   per conflicting field.
3. **Presence** — subscription and row indicators, degrading silently when the transport has no
   event channel.
4. **Read-only mode** driven by role.

The skill is unaffected. It keeps editing the repo directly, and git merges the two writers exactly
as it merges two developers.

## 10. Risks and open questions

- **Two transports to test forever.** Local and remote must both stay covered; the `FileApi`
  interface should be exercised by a shared conformance test rather than two divergent suites.
- **Disk growth** from per-user worktrees on a large repo. Sparse-checkout bounds the working tree
  but not the object store; idle worktrees should be reaped on a timer.
- **`.specpad/` cache regeneration** is skill-owned today and derived from git history. After a
  server push those caches are stale until a developer or CI regenerates them. Deciding whether the
  server regenerates them itself is deferred, and until then the editor's history views may lag for
  server-authored commits.
- **Notification.** Whether a PM's spec commit should open a PR, trigger CI, or notify the owning
  developer is a policy question we have deliberately left for after the first deployment.
- **Rebase edge cases** — a rename of `docs/specpad/` upstream, or a force-push of the target
  branch, both need explicit handling rather than a retry loop.
