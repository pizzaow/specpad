// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * The audit's mechanical stage (ADT-5). It runs against a scratch project rather than
 * SpecPad's own register, so the test says something about the checker rather than about
 * whatever state the register happens to be in today.
 */
const repo = path.resolve(__dirname, '../..');

function run(files: Record<string, string>): { code: number; out: string } {
  const dir = mkdtempSync(path.join(tmpdir(), 'specpad-audit-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: dir });
    for (const [rel, body] of Object.entries(files)) {
      mkdirSync(path.join(dir, path.dirname(rel)), { recursive: true });
      writeFileSync(path.join(dir, rel), body);
    }
    execFileSync('git', ['add', '-A'], { cwd: dir });
    try {
      const out = execFileSync(
        'npx',
        ['vite-node', path.join(repo, 'scripts/specpad-audit.mjs'), 'demo'],
        { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      );
      return { code: 0, out };
    } catch (e: any) {
      return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const proj = JSON.stringify({ schemaVersion: '1.0', type: 'project', name: 'demo', title: 'Demo', documents: [] });
const srs = (items: unknown[]) => JSON.stringify({ schemaVersion: '1.0', type: 'srs', name: 'demo', title: 'SRS', items });
const vtp = (items: unknown[]) => JSON.stringify({ schemaVersion: '1.0', type: 'vtp', name: 'demo', title: 'VTP', items });

describe('specpad-audit (ADT-5)', () => {
  it('exits zero and reports coverage on a clean register', () => {
    const { code, out } = run({
      'docs/specpad/demo.proj.json': proj,
      'docs/specpad/demo.srs.json': srs([{ id: 'r_1', code: 'A-1', text: 'Shall work.', cites: ['src/thing.ts:doIt'] }]),
      'docs/specpad/demo.vtp.json': vtp([{ id: 't_1', text: 'Try it.', verifies: ['r_1'], expected: 'Works.' }]),
      'src/thing.ts': 'export function doIt() {}\n',
    });
    expect(out).toMatch(/citation coverage\s+1 of 1 \(100%\)/);
    expect(out).toMatch(/citation resolution all resolve/);
    expect(out).toMatch(/Stage 1 clean/);
    expect(code).toBe(0);
  });

  it('fails on a citation whose construct was renamed away', () => {
    const { code, out } = run({
      'docs/specpad/demo.proj.json': proj,
      'docs/specpad/demo.srs.json': srs([{ id: 'r_1', code: 'A-1', text: 'Shall work.', cites: ['src/thing.ts:goneAway'] }]),
      'docs/specpad/demo.vtp.json': vtp([{ id: 't_1', text: 'Try it.', verifies: ['r_1'], expected: 'Works.' }]),
      'src/thing.ts': 'export function doIt() {}\n',
    });
    expect(out).toMatch(/BROKEN/);
    expect(out).toMatch(/goneAway/);
    expect(code).toBe(1);
  });

  it('fails on a VTP note naming a test that does not exist', () => {
    const { code, out } = run({
      'docs/specpad/demo.proj.json': proj,
      'docs/specpad/demo.srs.json': srs([{ id: 'r_1', code: 'A-1', text: 'Shall work.' }]),
      'docs/specpad/demo.vtp.json': vtp([
        { id: 't_1', code: 'T-1', text: 'Try it.', verifies: ['r_1'], expected: 'Works.', notes: 'src/thing.test.ts — "no such test"' },
      ]),
      'src/thing.test.ts': "it('a different name', () => {});\n",
    });
    expect(out).toMatch(/has no test named "no such test"/);
    expect(code).toBe(1);
  });

  it('attributes each quoted test name to the file preceding it, not to every file named', () => {
    // The checker's own regression: a note listing two files used to check every quote
    // against both, so any multi-file note was reported broken.
    const { code, out } = run({
      'docs/specpad/demo.proj.json': proj,
      'docs/specpad/demo.srs.json': srs([{ id: 'r_1', code: 'A-1', text: 'Shall work.' }]),
      'docs/specpad/demo.vtp.json': vtp([
        {
          id: 't_1', code: 'T-1', text: 'Try it.', verifies: ['r_1'], expected: 'Works.',
          notes: 'src/one.test.ts — "in the first file"; src/two.test.ts — "in the second file"',
        },
      ]),
      'src/one.test.ts': "it('in the first file', () => {});\n",
      'src/two.test.ts': "it('in the second file', () => {});\n",
    });
    expect(out).toMatch(/test references\s+0 broken/);
    expect(code).toBe(0);
  });

  it('reports coverage even when the register cites nothing, since the advisory stays quiet', () => {
    const { out } = run({
      'docs/specpad/demo.proj.json': proj,
      'docs/specpad/demo.srs.json': srs([{ id: 'r_1', code: 'A-1', text: 'Shall work.' }]),
      'docs/specpad/demo.vtp.json': vtp([{ id: 't_1', text: 'Try it.', verifies: ['r_1'], expected: 'Works.' }]),
    });
    expect(out).toMatch(/citation coverage\s+0 of 1 \(0%\)/);
  });
});
