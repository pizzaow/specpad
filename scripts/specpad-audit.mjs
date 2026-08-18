#!/usr/bin/env node
/**
 * specpad-audit — stage 1 of the audit: everything a machine can decide.
 *
 * `guides/audit.md` puts the mechanical checks first and always, so the expensive
 * reading passes are spent only on what cannot be settled deterministically. This is
 * that stage, and running it is the point: while it lived in a scratchpad it was
 * rewritten from memory each time, which is the opposite of a check.
 *
 * It reports four things and exits non-zero if any hard failure is found:
 *
 *   1. governance          — violations block; an audit over a dirty register measures nothing
 *   2. citation resolution — a cited file that is gone, or a symbol renamed away, is a
 *                            requirement claiming evidence that is not there
 *   3. citation coverage   — reported ALWAYS, including 0%: the `srs-cites` advisory stays
 *                            quiet for a register that has not adopted citations, so this is
 *                            where such a project hears how much of itself is checkable
 *   4. test references     — a VTP `notes` naming an automated test that no longer resolves
 *
 * Coverage is also the honest ceiling on the reading stage: what is uncited gets re-read,
 * not verified.
 *
 * Usage: node scripts/specpad-audit.mjs [project-name]   (default: specpad)
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { checkGovernance, checkAdvice, checkCitations } from '../src/shared/index.ts';

const name = process.argv[2] || 'specpad';
const DOCS = 'docs/specpad';

const read = (p) => { try { return readFileSync(p, 'utf8'); } catch { return null; } };
const doc = (kind) => { const t = read(`${DOCS}/${name}.${kind}.json`); return t ? JSON.parse(t) : null; };

const bundle = {
  project: doc('proj'), srs: doc('srs'), vtp: doc('vtp'), prd: doc('prd'),
  sdd: doc('sdd'), risk: doc('risk'), soup: doc('soup'), threat: doc('threat'),
  jobs: doc('jobs'), job: doc('job'),
};
if (!bundle.srs) {
  console.error(`No ${DOCS}/${name}.srs.json — nothing to audit.`);
  process.exit(2);
}

let hard = 0;
const say = (s = '') => console.log(s);

/* 1 ─ governance ─────────────────────────────────────────────────────────── */
const violations = checkGovernance(bundle);
const advice = checkAdvice(bundle);
say(`governance          ${violations.length} violations, ${advice.length} advisories`);
for (const v of violations) { say(`   BLOCKING  ${v.rule}: ${v.message}`); hard += 1; }
const byRule = advice.reduce((m, a) => m.set(a.rule, (m.get(a.rule) ?? 0) + 1), new Map());
for (const [rule, n] of [...byRule].sort((a, b) => b[1] - a[1])) say(`   advisory  ${String(n).padStart(4)}  ${rule}`);

/* 2/3 ─ citations ────────────────────────────────────────────────────────── */
const reqs = bundle.srs.items.filter((i) => !i.heading);
const cited = reqs.filter((i) => (i.cites ?? []).length).length;
const pct = reqs.length ? Math.round((cited / reqs.length) * 100) : 0;
say();
say(`citation coverage   ${cited} of ${reqs.length} (${pct}%) — the reading stage can CHECK ${pct}%; the rest it re-reads`);

const cf = checkCitations(bundle.srs.items, read);
const fatal = cf.filter((f) => f.problem !== 'line-anchor');
say(`citation resolution ${cf.length ? `${fatal.length} broken, ${cf.length - fatal.length} fragile` : 'all resolve'}`);
for (const f of cf) { say(`   ${f.problem === 'line-anchor' ? 'fragile ' : 'BROKEN  '}  ${f.message}`); }
hard += fatal.length;

/* 4 ─ test references ────────────────────────────────────────────────────── */
const tests = (bundle.vtp?.items ?? []).filter((t) => !t.heading);
const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).trim().split('\n');
const byBase = new Map();
for (const f of tracked) {
  const base = f.split('/').pop();
  byBase.set(base, [...(byBase.get(base) ?? []), f]);
}
const broken = [], vague = [];
const resolvePath = (ref, code) => {
  if (existsSync(ref)) return ref;
  const hits = byBase.get(ref.split('/').pop()) ?? [];
  if (hits.length !== 1) { broken.push(`${code}: ${ref} resolves to ${hits.length} files`); return null; }
  // A bare filename resolves today and silently stops resolving the day a second file takes
  // the name. Reported, not failed — it is imprecision, not a broken reference.
  vague.push(`${code}: "${ref}" is a bare filename; it is ${hits[0]}`);
  return hits[0];
};

for (const t of tests) {
  const notes = t.notes ?? '';
  const code = t.code ?? t.id;
  // A note may name several test files. Each quoted test name belongs to the file that
  // PRECEDES it, not to all of them — checking every quote against every path reports a
  // break for every note that lists more than one file, which is the checker being wrong
  // rather than the register.
  const paths = [...notes.matchAll(/[\w./-]+\.test\.[tj]sx?/g)].map((m) => ({ ref: m[0], at: m.index }));
  if (!paths.length) continue;
  const seen = new Set();
  for (const { ref, at } of paths) {
    if (seen.has(ref)) continue;
    seen.add(ref);
    resolvePath(ref, code);   // reports a bare or ambiguous filename once per note
    void at;
  }
  for (const q of notes.matchAll(/"([^"]{6,})"/g)) {
    const testName = q[1];
    if (testName.includes('.test.')) continue;
    const owner = [...paths].reverse().find((p2) => p2.at < q.index);
    if (!owner) continue;                       // a quote before any path names nothing
    const path = existsSync(owner.ref) ? owner.ref : (byBase.get(owner.ref.split('/').pop()) ?? [])[0];
    if (!path) continue;                        // already reported as unresolvable
    if (!readFileSync(path, 'utf8').includes(testName)) {
      broken.push(`${code}: ${path} has no test named "${testName}"`);
    }
  }
}
const noNotes = tests.filter((t) => !(t.notes ?? '').trim()).length;
say();
say(`test references     ${broken.length} broken, ${vague.length} imprecise; ${noNotes} of ${tests.length} tests name no automated test`);
for (const b of broken) say(`   BROKEN    ${b}`);
for (const v of vague) say(`   vague     ${v}`);
hard += broken.length;

/* ─ verdict ──────────────────────────────────────────────────────────────── */
say();
say(hard === 0
  ? 'Stage 1 clean. Stage 2 (the reading passes) is what remains — see guides/audit.md.'
  : `Stage 1 found ${hard} hard failure(s). Fix these before spending a reading pass.`);
process.exit(hard === 0 ? 0 : 1);
