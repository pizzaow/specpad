#!/usr/bin/env node
/**
 * Stale-design check, called by the SpecPad pre-push hook for one commit.
 *
 *   node stale-design.mjs <sha> [specdir]
 *
 * Each detailed-design section records the repository paths it describes. If a commit
 * changes one of those paths and leaves the section itself untouched, the design may no
 * longer describe the code. Prints those pairs and exits 1; exits 0 when there is
 * nothing to say, no detailed design, or anything unexpected.
 *
 * This is the re-review rule computed rather than remembered: it reports facts (this
 * path changed, that section did not) and never decides whether the design is wrong.
 */
import { execFileSync } from 'node:child_process';

const sha = process.argv[2];
const specdir = process.argv[3] || 'docs/specpad';
if (!sha) process.exit(0);

const git = (...args) => {
  try {
    // stderr is swallowed: "path exists on disk but not in <ref>" is an ordinary
    // answer here, not something to print at someone pushing.
    return execFileSync('git', args, {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return '';
  }
};

const changed = git('diff-tree', '--no-commit-id', '--name-only', '-r', sha)
  .split('\n')
  .filter(Boolean);
if (changed.length === 0) process.exit(0);

// The project's detailed design, not a cached snapshot of one: the register lives
// directly under the spec directory, while `.specpad/` holds regenerable copies.
const inProject = (f) =>
  f.endsWith('.sdd.json') && f.startsWith(`${specdir}/`) && !f.includes('/.specpad/');
const sddPath = git('ls-tree', '-r', '--name-only', sha, `${specdir}/`)
  .split('\n')
  .filter(Boolean)
  .find(inProject);
if (!sddPath) process.exit(0);

let sdd;
try {
  sdd = JSON.parse(git('show', `${sha}:${sddPath}`));
} catch {
  process.exit(0);
}
if (!Array.isArray(sdd.items)) process.exit(0);

// Sections whose own text this commit changed are already accounted for.
const touchedSdd = changed.includes(sddPath);
let before = null;
if (touchedSdd) {
  try {
    before = JSON.parse(git('show', `${sha}^:${sddPath}`));
  } catch {
    before = null;
  }
}
const bodyBefore = new Map((before?.items ?? []).map((s) => [s.id, s.body ?? '']));
const unchanged = (section) =>
  !touchedSdd || !before || bodyBefore.get(section.id) === (section.body ?? '');

/** Does a changed file fall under a path a section claims? */
const claims = (source, file) =>
  source.some((p) => {
    const path = p.replace(/\/+$/, '');
    return file === path || file.startsWith(`${path}/`);
  });

const stale = [];
for (const section of sdd.items) {
  if (section.heading) continue;
  const source = (section.source ?? []).filter(Boolean);
  if (source.length === 0) continue;
  if (!unchanged(section)) continue;
  const hits = changed.filter((f) => f !== sddPath && claims(source, f));
  if (hits.length > 0) stale.push({ section, hits });
}

if (stale.length === 0) process.exit(0);

for (const { section, hits } of stale) {
  for (const file of hits) console.error(`      ${file}`);
  const label = `${section.code ? `${section.code} ` : ''}${section.title}`.trim();
  console.error(`        └─ ${label}  (design unchanged)`);
}
process.exit(1);
