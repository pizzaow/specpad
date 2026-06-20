// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const hook = fileURLToPath(new URL('../specpad/templates/hooks/pre-push', import.meta.url));
const env = {
  ...process.env,
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t',
  GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
};

let repo: string;
const git = (args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', env });
const head = () => git(['rev-parse', 'HEAD']).trim();

function commit(message: string, files: Record<string, string>) {
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(repo, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  git(['add', '-A']);
  git(['commit', '-qm', message]);
  return head();
}

/** Run the hook for a push of `local` against already-pushed `base`; returns exit code + output. */
function runHook(local: string, base: string, extraEnv: Record<string, string> = {}): { code: number; out: string } {
  const r = spawnSync('bash', [hook, 'origin', 'https://example/repo.git'], {
    cwd: repo, encoding: 'utf8', env: { ...env, ...extraEnv },
    input: `refs/heads/main ${local} refs/heads/main ${base}\n`,
  });
  return { code: r.status ?? 1, out: `${r.stderr ?? ''}${r.stdout ?? ''}` };
}

describe('pre-push hook', () => {
  beforeAll(() => {
    repo = mkdtempSync(path.join(tmpdir(), 'specpad-hook-'));
    git(['init', '-q']);
    git(['symbolic-ref', 'HEAD', 'refs/heads/main']);
    commit('chore: adopt specpad', { 'docs/specpad/x.srs.json': '{}', 'docs/specpad/x.vtp.json': '{}' });
  });
  afterAll(() => rmSync(repo, { recursive: true, force: true }));

  it('blocks a code commit with no Job: trailer', () => {
    const before = head();
    const local = commit('feat: a', { 'feature.ts': 'export const a = 1;\n' });
    const r = runHook(local, before);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/no Job: trailer/);
  });

  it('allows a commit that carries a Job trailer and a spec change', () => {
    const before = head();
    const local = commit('feat: b\n\nJob: j_test01', {
      'feature2.ts': 'export const b = 2;\n',
      'docs/specpad/x.srs.json': '{"b":2}',
    });
    const r = runHook(local, before);
    expect(r.code).toBe(0);
    expect(r.out).not.toMatch(/⚠/);
  });

  it('warns (but does not block) when code changes without an SRS/VTP touch', () => {
    const before = head();
    const local = commit('feat: c\n\nJob: j_test01', { 'feature3.ts': 'export const c = 3;\n' });
    const r = runHook(local, before);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/changed code but no SRS\/VTP/);
  });

  it('suppresses the warning with a Spec: none trailer (e.g. a refactor)', () => {
    const before = head();
    const local = commit('refactor: tidy\n\nJob: j_test01\nSpec: none refactor only', { 'feature3.ts': 'export const c = 3; // tidy\n' });
    const r = runHook(local, before);
    expect(r.code).toBe(0);
    expect(r.out).not.toMatch(/changed code but no SRS\/VTP/);
  });

  it('skips tag pushes (they point at already-pushed commits)', () => {
    const before = head();
    const local = commit('release: no job trailer', { 'feature9.ts': 'export const t = 9;\n' });
    // As a branch push this would block (no Job trailer); as a tag push it must be skipped.
    expect(runHook(local, before).code).toBe(1);
    const tag = spawnSync('bash', [hook, 'origin', 'url'], {
      cwd: repo, encoding: 'utf8', env,
      input: `refs/tags/v1.0 ${local} refs/tags/v1.0 ${ZERO}\n`,
    });
    expect(tag.status ?? 1).toBe(0);
  });

  it('is fully bypassed with SPECPAD_SKIP=1', () => {
    const before = head();
    const local = commit('wip: no job', { 'feature4.ts': 'export const d = 4;\n' });
    // Without the bypass this would block (no Job: trailer); with it, it passes.
    expect(runHook(local, before).code).toBe(1);
    expect(runHook(local, before, { SPECPAD_SKIP: '1' }).code).toBe(0);
  });
});
