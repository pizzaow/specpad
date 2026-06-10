# SpecPad infrastructure

`specpad.com` is served as a static site from a private S3 bucket behind CloudFront,
per the design spec §5.4. Everything is provisioned by `deploy.sh` (idempotent).

## Live resources (account 904915073567, us-east-1)

| Resource | Identifier |
|----------|-----------|
| Route 53 hosted zone | `Z09704161B5ZGGXP7VXYH` (`specpad.com`) |
| ACM certificate | `arn:aws:acm:us-east-1:904915073567:certificate/afbab250-b805-4574-aeab-18e75addf8fb` |
| S3 bucket (private) | `specpad-web-904915073567` — builds under `v01/` |
| CloudFront distribution | `E37XJUZS3ENIU9` (`do3walxgtdhm0.cloudfront.net`) |
| CloudFront function | `specpad-rewrite` (viewer-request URL rewrite) |
| Origin Access Control | `E3M6947TP1098C` |

- Site: <https://specpad.com/v01/> — apex `https://specpad.com/` rewrites to `/v01/index.html`.
- The domain's nameservers were repointed from Google to this hosted zone.

## Full provision / re-run

```bash
infra/deploy.sh            # idempotent: creates anything missing, waits on slow steps
infra/deploy.sh --no-wait  # skip the final distribution-deployed waiter
```

Safe to re-run after a timeout (nameserver propagation or cert validation) — it resumes.

## Ship a new build (content-only update)

The schema version maps to the path (`"1.0"` → `/v01/`). To publish a new build of the
**same** schema version, run the routine deploy — it builds, uploads, and **always
invalidates** the cache so the edge can't serve a stale bundle:

```bash
infra/deploy.sh --ship
```

Equivalent to what `--ship` runs under the hood:

```bash
npm run build
aws s3 sync dist/ s3://specpad-web-904915073567/v01/ --delete
aws cloudfront create-invalidation --distribution-id E37XJUZS3ENIU9 --paths '/v01/*'
```

A future `schemaVersion: "2.0"` publishes to `/v02/` alongside `/v01/`, which stays live so
old files keep opening in a compatible editor.

## Demo content

Demo documents live at `https://specpad.com/demo/` — uploaded from `docs/specpad/` by `--ship`.
A `manifest.json` is generated at upload time listing every `*.{srs,vtp,proj}.json` file;
the local `index.html` launcher is excluded from the upload.

The live demo URL is `https://specpad.com/v01/?demo` — the editor fetches
`/demo/manifest.json` and loads the listed documents in read-only demo mode.
