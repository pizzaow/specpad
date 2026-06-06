# SpecPad

AI-governed, browser-based editor for software documentation: requirements (SRS), verification
tests (VTP), and a project index — stored as structured JSON in your git repo.

SpecPad has two co-governed halves that share one contract:

- A **Claude Code skill** (`skill/specpad/`) that creates and maintains the structured files
  programmatically.
- A **hosted visual editor** (this app, served versioned from `specpad.com/v01/`) for editing the
  same files by hand.

Both obey one shared contract — the v1 JSON schema plus a single validation/governance module in
`src/shared/`. Git is the history and merge layer between the two.

## Layout

| Path | What |
|------|------|
| `src/shared/` | The contract: v1 schema, `validate`, `checkGovernance`, id generation, factories |
| `src/` (rest) | The React editor (File System Access API, live validation) |
| `skill/specpad/` | The distributable Claude Code skill + scaffolding templates |
| `docs/specpad/` | SpecPad's own requirements & tests, authored with SpecPad (dogfood) |
| `docs/design/` | The v1 design spec (source of truth for scope and schema) |

## Develop

```bash
npm install
npm run dev      # Vite dev server
npm test         # Vitest (contract module + editor + dogfood docs)
npm run build    # production build → dist/ (deployed at specpad.com/v01/)
npm run lint
```

Full support in Chrome/Edge (File System Access API). Firefox/Safari use a manual upload/download
fallback.

## Status

Editor, contract, and skill are complete on the **v1 schema**. Cloud deployment (S3 + CloudFront on
`specpad.com`) is the remaining piece.

## License

MIT
