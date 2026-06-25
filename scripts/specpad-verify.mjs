#!/usr/bin/env node
/**
 * specpad-verify — capture a verification run as a normalized SpecPad RunRecord.
 *
 * This is the **vitest adapter**: it runs the suite with vitest's JSON reporter and
 * maps the report to the framework-agnostic run-record shape the contract defines
 * ({ runner, ref, ranAt, summary, results:[{file, selector, status, durationMs}] }).
 * SpecPad's core never parses test frameworks — adding Playwright/jest/pytest is a
 * sibling adapter (or your CI emits the same JSON directly).
 *
 * Usage: node scripts/specpad-verify.mjs [project-name]   (default: specpad)
 * Writes docs/specpad/.specpad/run/<name>.run.json (the latest run; the skill freezes
 * a copy into the release baseline and each closed job's cache — the key deliverables).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const repoRoot = process.cwd();
const name = process.argv[2] || 'specpad';
const outDir = `docs/specpad/.specpad/run`;
const outFile = `${outDir}/${name}.run.json`;
const reportFile = resolve(repoRoot, '.specpad-vitest-report.json');

const git = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const ref = git(['rev-parse', 'HEAD']);
const ranAt = git(['log', '-1', '--format=%cs', 'HEAD']); // commit date; deterministic, no wall clock

console.error('Running vitest (JSON reporter)…');
try {
  execFileSync('npx', ['vitest', 'run', '--reporter=json', `--outputFile=${reportFile}`], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
} catch {
  // vitest exits non-zero on test failures; we still want to capture the report.
}

const report = JSON.parse(readFileSync(reportFile, 'utf8'));
const status = (s) => (s === 'passed' ? 'passed' : s === 'failed' ? 'failed' : 'skipped');

const results = [];
for (const suite of report.testResults ?? []) {
  const file = relative(repoRoot, suite.name).split('\\').join('/');
  for (const a of suite.assertionResults ?? []) {
    results.push({
      file,
      selector: a.fullName || a.title,
      status: status(a.status),
      ...(typeof a.duration === 'number' ? { durationMs: Math.round(a.duration) } : {}),
    });
  }
}

const record = {
  schemaVersion: '1.0',
  type: 'run',
  name,
  runner: 'vitest',
  ref,
  ranAt,
  summary: {
    total: report.numTotalTests ?? results.length,
    passed: report.numPassedTests ?? results.filter((r) => r.status === 'passed').length,
    failed: report.numFailedTests ?? results.filter((r) => r.status === 'failed').length,
    skipped: report.numPendingTests ?? results.filter((r) => r.status === 'skipped').length,
  },
  results,
};

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, JSON.stringify(record, null, 2) + '\n');
rmSync(reportFile, { force: true });
console.error(`Wrote ${outFile} — ${record.summary.passed}/${record.summary.total} passed at ${ref.slice(0, 9)}`);
