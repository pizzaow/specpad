# SpecPad infrastructure

`specpad.com` is served as a static site from a private S3 bucket behind CloudFront,
per the design spec §5.4. Everything is provisioned by `deploy.sh` (idempotent).

## Live resources (account 904915073567, us-east-1)

| Resource | Identifier |
|----------|-----------|
| Route 53 hosted zone | `Z09704161B5ZGGXP7VXYH` (`specpad.com`) |
| ACM certificate | `arn:aws:acm:us-east-1:904915073567:certificate/afbab250-b805-4574-aeab-18e75addf8fb` |
| S3 bucket (private) | `specpad-web-904915073567` — marketing site at root, editor builds under `v01/` |
| CloudFront distribution | `E37XJUZS3ENIU9` (`do3walxgtdhm0.cloudfront.net`) |
| CloudFront function | `specpad-rewrite` (viewer-request URL rewrite) |
| Origin Access Control | `E3M6947TP1098C` |

- Marketing site: <https://specpad.com/> — apex `https://specpad.com/` rewrites to `/index.html` (marketing site).
- Editor: <https://specpad.com/v01/> — version-pinned editor build.
- The domain's nameservers were repointed from Google to this hosted zone.

## Full provision / re-run

```bash
infra/deploy.sh            # idempotent: creates anything missing, waits on slow steps
infra/deploy.sh --no-wait  # skip the final distribution-deployed waiter
```

Safe to re-run after a timeout (nameserver propagation or cert validation) — it resumes.

**Apex flip note:** The full run also updates and publishes the CloudFront function with the
current code from `infra/cloudfront-function.js`. A `--ship` alone uploads new content but
does **not** push function code changes. To activate the apex flip (apex → marketing site
instead of the editor), you must run a full `infra/deploy.sh` once — after that, `--ship`
keeps the apex correct because the function is already up to date.

## Ship a new build (content-only update)

The schema version maps to the path (`"1.0"` → `/v01/`). To publish a new build of the
**same** schema version, run the routine deploy — it builds, uploads, and **always
invalidates** the cache so the edge can't serve a stale bundle:

```bash
infra/deploy.sh --ship
```

`--ship` runs five steps:

1. Build the editor (`npm run build` → `dist/`)
2. Upload editor to `s3://specpad-web-904915073567/v01/`
3. Upload demo content to `s3://specpad-web-904915073567/demo/`
4. Build the marketing site (`npm run build:site` → `dist-site/`), bundle the skill zip into
   `dist-site/specpad-skill.zip`, and sync `dist-site/` to the bucket root — `--delete` is
   scoped with `--exclude "v0*/*" --exclude "demo/*"` so versioned editor builds and demo
   content are never deleted by the root sync.
5. Invalidate `/*` on CloudFront.

```bash
# Step 4 in longhand (site + zip, then root sync with safe --delete scoping):
npm run build:site
( cd skill && zip -qr ../dist-site/specpad-skill.zip specpad )
aws s3 sync dist-site/ s3://specpad-web-904915073567/ --delete --exclude "v0*/*" --exclude "demo/*"
```

A future `schemaVersion: "2.0"` publishes to `/v02/` alongside `/v01/`, which stays live so
old files keep opening in a compatible editor.

## Demo content

Demo documents live at `https://specpad.com/demo/` — uploaded from `docs/specpad/` by `--ship`.
A `manifest.json` is generated at upload time listing every `*.{srs,vtp,proj}.json` file;
the local `index.html` launcher is excluded from the upload.

The live demo URL is `https://specpad.com/v01/?demo` — the editor fetches
`/demo/manifest.json` and loads the listed documents in read-only demo mode.
