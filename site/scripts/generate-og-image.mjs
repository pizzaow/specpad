/**
 * Generates site/public/og-image.png (1200x630) by screenshotting a
 * self-contained HTML card rendered in the site's visual language.
 * No server needed — the page is set via page.setContent.
 *
 * Usage: NODE_PATH=$(npm root -g) node site/scripts/generate-og-image.mjs
 * Re-run after changing the hero headline or the visual tokens.
 */
import { createRequire } from 'node:module';

// createRequire honours NODE_PATH (ESM `import` does not), so the globally
// installed playwright resolves.
const { chromium } = createRequire(import.meta.url)('playwright');

const OUT = new URL('../public/og-image.png', import.meta.url).pathname;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  :root {
    --bg: #0d1117; --surface: #161b22; --border: #30363d;
    --text: #e6edf3; --muted: #8b949e;
    --accent: #3fb950; --blue: #1f6feb; --red: #f85149;
    --mono: ui-monospace, 'SFMono-Regular', 'JetBrains Mono', Menlo, Consolas, monospace;
    --sans: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif;
  }
  * { box-sizing: border-box; margin: 0; }
  body {
    width: 1200px; height: 630px; overflow: hidden;
    background:
      radial-gradient(ellipse 60% 55% at 78% 24%, rgba(63, 185, 80, 0.1), transparent 70%),
      radial-gradient(ellipse 45% 45% at 8% 92%, rgba(31, 111, 235, 0.08), transparent 70%),
      repeating-linear-gradient(0deg, rgba(48, 54, 61, 0.22) 0 1px, transparent 1px 56px),
      repeating-linear-gradient(90deg, rgba(48, 54, 61, 0.22) 0 1px, transparent 1px 56px),
      var(--bg);
    color: var(--text); font-family: var(--sans);
    -webkit-font-smoothing: antialiased;
    display: flex; align-items: center; gap: 64px;
    padding: 0 72px;
  }
  .copy { flex: 1; min-width: 0; }
  .logo {
    font-family: var(--mono); font-size: 34px; font-weight: 700;
    letter-spacing: -0.04em; margin-bottom: 40px;
  }
  .logo .cursor { color: var(--accent); }
  h1 {
    font-size: 64px; font-weight: 800; line-height: 1.08;
    letter-spacing: -0.035em; margin-bottom: 32px;
  }
  h1 .accent {
    color: var(--accent);
    text-decoration: underline;
    text-decoration-thickness: 5px;
    text-decoration-color: rgba(63, 185, 80, 0.4);
    text-underline-offset: 11px;
  }
  .sub {
    font-family: var(--mono); font-size: 21px; color: var(--muted);
    letter-spacing: 0.01em;
  }
  .sub .prompt { color: var(--accent); }
  .card {
    flex: none; width: 420px;
    background: var(--surface);
    border: 1px solid var(--border); border-radius: 12px;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5), 0 0 80px rgba(63, 185, 80, 0.07);
    transform: rotate(1deg);
    font-family: var(--mono);
  }
  .chrome {
    display: flex; align-items: center; gap: 7px;
    padding: 13px 18px; border-bottom: 1px solid var(--border);
  }
  .dot { width: 12px; height: 12px; border-radius: 50%; background: var(--border); }
  .file { margin-left: 9px; font-size: 13px; color: var(--muted); }
  pre { padding: 20px 0; font-size: 16.5px; line-height: 2.1; }
  pre span { display: block; padding: 0 22px; white-space: pre; }
  .hunk { color: var(--blue); }
  .ctx { color: var(--muted); }
  .del { color: var(--red); background: rgba(248, 81, 73, 0.12); }
  .add { color: var(--accent); background: rgba(63, 185, 80, 0.13); }
  .foot {
    display: flex; gap: 18px; padding: 12px 22px;
    border-top: 1px solid var(--border); font-size: 13px; color: var(--accent);
  }
</style>
</head>
<body>
  <div class="copy">
    <div class="logo">specpad<span class="cursor">_</span></div>
    <h1>Requirements that live in <span class="accent">your repo</span>.</h1>
    <p class="sub"><span class="prompt">$</span> git log docs/specpad/srs.json</p>
  </div>
  <div class="card">
    <div class="chrome">
      <span class="dot"></span><span class="dot"></span><span class="dot"></span>
      <span class="file">specpad.srs.json</span>
    </div>
    <pre><span class="hunk">@@ REQ-12 @@</span><span class="ctx">  "code": "REQ-12",</span><span class="del">- "status": "draft"</span><span class="add">+ "status": "approved"</span></pre>
    <div class="foot">
      <span>&#10003; schema valid</span>
      <span>&#10003; governance clean</span>
    </div>
  </div>
</body>
</html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.screenshot({ path: OUT });
  console.log(`og-image written to ${OUT}`);
} finally {
  await browser.close();
}
