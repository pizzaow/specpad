/**
 * Captures the marketing screenshots from the editor running in demo mode.
 * Prereq: `npm run dev` on :5173 (demo middleware serves docs/specpad at /demo).
 * Usage:  npm run capture:screenshots
 *         NODE_PATH=$(npm root -g) node site/scripts/capture-screenshots.mjs
 *         (set EDITOR_URL if Vite picked a different port)
 * Re-run after any editor UI change so the marketing shots never go stale.
 *
 * Output dims are fixed by the <img width/height> contract in site/index.html:
 *   srs-table / testing-view / redlines : 1400x620 (x2 dpr -> 2800x1240)
 *   version-history                     : 1400x900 (full viewport)
 *   job-chip                            : 420x56
 *   status-bar                          : 1400x44
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

// createRequire honours NODE_PATH (ESM `import` does not), so the globally
// installed playwright resolves: NODE_PATH=$(npm root -g) node <this script>
const { chromium } = createRequire(import.meta.url)('playwright');

const BASE = process.env.EDITOR_URL ?? 'http://localhost:5173';
const OUT = new URL('../public/assets/shots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
  await page.goto(`${BASE}/?demo`);
  // Demo data is loaded once the read-only badge renders. v1.3 opens on the
  // Overview, so switch to the Requirements tab before the spec shots.
  await page.waitForSelector('.status-demo');
  await page.click('.view-tabs >> text=Requirements');
  await page.waitForSelector('.srs-table-container table tbody tr');
  // Wait out the initial "Loading…" banner (change-tracking caches still fetching).
  await page
    .waitForFunction(() => !/Loading…|Loading\.\.\./.test(document.body.textContent || ''), { timeout: 15000 })
    .catch(() => {});
  await page.waitForTimeout(800); // let the reveal animation and web fonts settle

  // fullPage is required whenever the clip lies below the 1400x900 viewport.
  const shot = (name, clip, fullPage = false) =>
    page.screenshot({ path: `${OUT}${name}.png`, fullPage, ...(clip ? { clip } : {}) });

  // The page is never scrolled before measuring, so boundingBox() (viewport
  // coords) equals document coords, which is what screenshot clips use.
  const box = async (selector) => {
    const b = await page.locator(selector).first().boundingBox();
    if (!b) throw new Error(`No bounding box for ${selector}`);
    return b;
  };

  // 1. SRS table — menubar + tabs + the top of the requirements table
  //    (heading rows and the requirement hierarchy are in the first screenful).
  await shot('srs-table', { x: 0, y: 0, width: 1400, height: 620 });

  // 2. Testing view with the pass/fail/pending roll-up labels at the top.
  await page.click('.view-tabs >> text=Results');
  await page.waitForSelector('.testing-view-container');
  await page.waitForTimeout(600);
  await shot('testing-view', { x: 0, y: 0, width: 1400, height: 620 });

  // 3. Redlines on the VTP view — the demo working copy has rows added since the
  //    v1.0 baseline, rendered as green `tr.success` rows. Clip around the first
  //    added row so unchanged rows above give contrast.
  await page.click('.view-tabs >> text=Verification Tests');
  await page.waitForSelector('.vtp-table-container');
  await page.waitForTimeout(600);
  // Redline rows (tr.success) only exist when the working copy differs from the
  // baseline. Right after a release the demo == baseline, so fall back to the top
  // of the VTP table when there's nothing to redline.
  if ((await page.locator('.vtp-table-container tr.success').count()) > 0) {
    const firstAdded = await box('.vtp-table-container tr.success');
    const docHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const redlineY = Math.max(0, Math.min(Math.round(firstAdded.y) - 220, docHeight - 620));
    await shot('redlines', { x: 0, y: redlineY, width: 1400, height: 620 }, redlineY + 620 > 900);
  } else {
    await shot('redlines', { x: 0, y: 0, width: 1400, height: 620 });
  }

  // 4. Version history dialog (opened from the menubar's version chip — the
  //    chip shows the current baseline version, e.g. v1.3).
  await page.locator('.menubar button').filter({ hasText: /^v\d/ }).first().click();
  await page.waitForSelector('.modal.in');
  await page.waitForTimeout(400);
  await shot('version-history'); // full 1400x900 viewport
  await page.click('.modal-footer button:has-text("Close")');

  // 5. Job chip — in demo mode the menubar shows "Job: <job>" on the right.
  //    Centre a 420x56 clip on it (vertically centred on the menubar).
  const chip = await box('.menubar >> text=Job:');
  const menubar = await box('.menubar');
  const chipClip = {
    x: Math.max(0, Math.min(Math.round(chip.x + chip.width / 2 - 210), 1400 - 420)),
    y: Math.max(0, Math.round(menubar.y + menubar.height / 2 - 28)),
    width: 420,
    height: 56,
  };
  await shot('job-chip', chipClip);

  // 6. Status bar with the validation summary (bottom of the document).
  const bar = await box('.status-bar');
  const barY = Math.round(bar.y + bar.height / 2 - 22);
  await shot('status-bar', { x: 0, y: barY, width: 1400, height: 44 }, barY + 44 > 900);

  console.log(`6 screenshots written to ${OUT}`);
} finally {
  await browser.close();
}
