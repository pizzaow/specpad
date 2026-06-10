# SpecPad

**Requirements that live in your repo.** Traceable software requirements (SRS) and verification
tests (VTP) stored as schema-validated JSON in git — kept in sync with your code by a Claude Code
skill, reviewed and approved by humans in a visual editor.

- **Website:** <https://specpad.com/>
- **Editor:** <https://specpad.com/v01/> · **live demo:** <https://specpad.com/v01/?demo> (SpecPad's own spec, read-only)
- **Schema reference:** <https://specpad.com/reference/>
- **Skill download:** <https://specpad.com/specpad-skill.zip>

SpecPad has two co-governed halves that share one contract:

- A **Claude Code skill** (`skill/specpad/`) that creates and maintains the structured files
  programmatically — say "update the spec" and requirements and tests stay current.
- A **visual editor** (this app) for reviewing and editing the same files by hand. It opens files
  straight from your repo via the File System Access API — no server, nothing leaves your machine.

Both obey one shared contract — the v1 JSON Schemas plus a single validation/governance module in
`src/shared/`. Git is the history and merge layer between the two: no modified-by fields, no stored
roll-ups, releases are just git tags.

## Layout

| Path | What |
|------|------|
| `src/shared/` | The contract: v1 schemas (with full field descriptions), `validate`, `checkGovernance`, id generation, factories |
| `src/` (rest) | The React editor (File System Access API, live validation, redlines, version history) |
| `skill/specpad/` | The distributable Claude Code skill + scaffolding templates |
| `site/` | The marketing site + build-time-generated schema reference |
| `docs/specpad/` | SpecPad's own requirements & tests, authored with SpecPad (dogfood) |
| `docs/design/` | The v1 design spec (source of truth for scope and schema) |

## Install the skill

1. Download [`specpad-skill.zip`](https://specpad.com/specpad-skill.zip)
2. Unzip into `~/.claude/skills/` (so `~/.claude/skills/specpad/SKILL.md` exists)
3. In any repo, tell Claude Code: `set up specpad`

Full instructions: <https://specpad.com/reference/#install>

## Develop

```bash
npm install
npm run dev        # editor dev server (add ?demo to browse the bundled demo spec)
npm run dev:site   # marketing site dev server
npm test           # Vitest: contract + editor + skill parity + dogfood docs
npm run build      # editor → dist/
npm run build:site # marketing site + generated reference → dist-site/
npm run lint
```

Full editor support in Chrome/Edge (File System Access API); Firefox/Safari use an
upload/download fallback.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the contract rules and how to submit changes.

## Deployment

The public site is deployed by the maintainer; deployment scripts and AWS resource identifiers
live in a private repo. The `schemaVersion` in every document maps to a pinned editor build
(`"1.0"` → `/v01/`), and old version paths stay live forever so old documents always open in an
editor that understands them.

## License

[MIT](LICENSE)
